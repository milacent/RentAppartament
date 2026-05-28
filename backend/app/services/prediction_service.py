"""Prediction service."""
import time
import numpy as np
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.prediction_repository import PredictionRepository
from app.models import Prediction, Image
from app.ml.model_loader import ModelLoader
from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.utils.logger import logger


class PredictionService:
    """Service for prediction operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.prediction_repo = PredictionRepository(db)
        self.model_dict = ModelLoader.get_model()
        self.model = self.model_dict['final_model']

    async def create_prediction(self, user_id: int, data: dict) -> Prediction:
        """Create new prediction with ML inference using 10 input fields."""
        try:
            from app.ml.simple_preprocessor import clean_rooms, preprocess_input

            # Prepare input data with only 10 required fields
            input_data = {
                'region': data.get('region'),
                'address': data.get('address'),
                'square': data.get('square'),
                'floor': data.get('floor'),
                'max_floor': data.get('max_floor'),
                'metro': data.get('metro'),
                'rooms': data.get('rooms'),
                'time': data.get('time'),
                'time_type': data.get('time_type', 'walk'),
                'description': data.get('description', ''),
            }
            rooms_clean = clean_rooms(input_data['rooms'])
            
            # Log input data for debugging
            logger.info(f"Raw input rooms: {repr(input_data['rooms'])} (type: {type(input_data['rooms']).__name__})")
            logger.info(f"Cleaned rooms: {rooms_clean}")
            logger.info(f"Input data details:")
            logger.info(f"  region: {input_data['region']}")
            logger.info(f"  address: {input_data['address']}")
            logger.info(f"  square: {input_data['square']} (type: {type(input_data['square']).__name__})")
            logger.info(f"  floor: {input_data['floor']}/{input_data['max_floor']}")
            logger.info(f"  metro: {input_data['metro']}")
            logger.info(f"  time_to_metro: {input_data['time']} min ({input_data['time_type']})")
            logger.info(f"  description: {input_data['description'][:50]}..." if len(str(input_data['description'])) > 50 else f"  description: {input_data['description']}")

            # Preprocess to 76 features
            features = preprocess_input(input_data, self.model_dict)
            logger.info(f"Features shape: {features.shape}, columns: {list(features.columns[:5])}...")

            # Run inference
            start_time = time.time()
            log_prediction = float(self.model.predict(features)[0])
            # Model predicts log(price) using log1p, so we need to apply expm1()
            prediction_raw = float(np.expm1(log_prediction))
            # If configured, return Colab-style raw prediction (rounded to hundreds)
            if getattr(settings, 'USE_COLAB_PREDICTION', False):
                prediction = float(round(prediction_raw, -2))
                calibration_factor = 1.0
            else:
                calibration_factor = float(settings.PRICE_CALIBRATION_FACTOR)
                prediction = prediction_raw * calibration_factor
            inference_time = (time.time() - start_time) * 1000

            logger.info(
                f"PREDICTION RESULT: Log pred: {log_prediction:.6f}, Raw: {prediction_raw:.2f} ₽, "
                f"Calibrated: {prediction:.2f} ₽ (factor: {calibration_factor:.3f}), Inference: {inference_time:.2f}ms"
            )

            # Extract city from region, not from user-provided city field
            region = str(data.get('region', 'Unknown') or 'Unknown').strip()
            extract_city_from_region = self.model_dict.get('extract_city_from_region') or self.model_dict.get('extract_city')
            if extract_city_from_region:
                try:
                    city = extract_city_from_region(region)
                except:
                    city = region.split(' и ')[0] if ' и ' in region else region
            else:
                city = region.split(' и ')[0] if ' и ' in region else region

            # Extract street_type from address if possible
            address = data.get('address', '')
            street_type = data.get('street_type')
            if not street_type:
                # Try to extract street type from address (e.g., "ул.", "пр.", "пл.", "переулок")
                common_types = ['ул.', 'пр.', 'пл.', 'переулок', 'бульвар', 'кв-л', 'тупик']
                for st in common_types:
                    if st in address:
                        street_type = st
                        break
                if not street_type:
                    street_type = 'улица'

            # Prepare data for storage in DB
            pred_data = {
                'user_id': user_id,
                'title': data.get('title') or address or 'Квартира',
                'description': data.get('description'),
                'region': region,
                'city': city,
                'metro': data.get('metro'),
                'street_type': street_type,
                'district': data.get('district'),
                'square': data.get('square'),
                'rooms_clean': rooms_clean,
                'floor': data.get('floor'),
                'max_floor': data.get('max_floor'),
                'time_to_metro': data.get('time', 15),
                'latitude': data.get('latitude'),
                'longitude': data.get('longitude'),
                'predicted_price': prediction,
                'confidence_score': None
            }

            pred_obj = await self.prediction_repo.create(pred_data)

            return pred_obj
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            raise ValidationError(f"Prediction failed: {str(e)}")

    async def get_prediction(self, user_id: int, prediction_id: int) -> Prediction:
        """Get prediction by ID."""
        prediction = await self.prediction_repo.get_by_user_and_id(user_id, prediction_id)

        if not prediction:
            raise NotFoundError("Prediction")

        return prediction

    async def get_user_predictions(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[Prediction]:
        """Get all user predictions."""
        return await self.prediction_repo.get_user_predictions(user_id, skip, limit)

    async def get_user_predictions_count(self, user_id: int) -> int:
        """Get user predictions count."""
        return await self.prediction_repo.get_user_prediction_count(user_id)

    async def delete_prediction(self, user_id: int, prediction_id: int) -> bool:
        """Delete prediction."""
        prediction = await self.prediction_repo.get_by_user_and_id(user_id, prediction_id)

        if not prediction:
            raise NotFoundError("Prediction")

        await self.db.delete(prediction)
        await self.db.commit()
        return True

    async def get_analytics(self, user_id: int, days: int = 90) -> dict:
        """Get analytics for user predictions.

        Produces detailed analytics:
        - price stats (avg, min, max, median, std, variance)
        - timeseries with optional moving averages (7/30d)
        - by_district (avg, count)
        - by_rooms (avg, count, percentage)
        - price_buckets + finer histogram
        - percentiles (10/25/50/75/90)
        - growth percent over the period, top/bottom districts, recent_predictions metadata
        """
        # fetch recent predictions (limit large to cover days)
        predictions = await self.prediction_repo.get_user_predictions(
            user_id, skip=0, limit=5000
        )

        # filter by days
        from datetime import datetime, timedelta, timezone
        # ensure cutoff is timezone-aware (UTC) to compare with created timestamps
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        filtered = []
        for p in predictions:
            try:
                if isinstance(p.created_at, datetime):
                    created = p.created_at
                else:
                    created = datetime.fromisoformat(p.created_at)

                # normalize created to timezone-aware UTC
                if created is not None:
                    if created.tzinfo is None:
                        created = created.replace(tzinfo=timezone.utc)
                    else:
                        created = created.astimezone(timezone.utc)
            except Exception:
                created = None
            if created and created >= cutoff:
                filtered.append(p)

        if not filtered:
            return {
                'total_predictions': 0,
                'price_stats': {'avg_price': 0.0, 'min_price': 0.0, 'max_price': 0.0, 'median_price': 0.0, 'std_dev': 0.0, 'variance': 0.0, 'count': 0},
                'by_district': [],
                'timeseries': [],
                'timeseries_with_ma': [],
                'by_rooms': [],
                'price_buckets': [],
                'price_histogram': [],
                'percentiles': {},
                'growth_pct': 0.0,
                'top_districts': [],
                'bottom_districts': [],
                'recent_predictions': [],
                'last_update': datetime.now(timezone.utc).isoformat()
            }

        prices = np.array([float(p.predicted_price or 0.0) for p in filtered], dtype=float)
        total = len(filtered)

        # price stats
        avg_price = float(np.mean(prices))
        min_price = float(np.min(prices))
        max_price = float(np.max(prices))
        median_price = float(np.median(prices))
        std_dev = float(np.std(prices, ddof=0))
        variance = float(np.var(prices, ddof=0))

        price_stats = {
            'avg_price': avg_price,
            'min_price': min_price,
            'max_price': max_price,
            'median_price': median_price,
            'std_dev': std_dev,
            'variance': variance,
            'count': total
        }

        # by_district aggregation
        district_map = {}
        for p in filtered:
            district = (p.district or 'Unknown')
            if district not in district_map:
                district_map[district] = {'sum': 0.0, 'count': 0}
            district_map[district]['sum'] += float(p.predicted_price or 0.0)
            district_map[district]['count'] += 1
        by_district = []
        for district, vals in district_map.items():
            avg = vals['sum'] / vals['count'] if vals['count'] > 0 else 0.0
            by_district.append({'district': district, 'avg_price': float(avg), 'count': vals['count']})
        by_district.sort(key=lambda x: x['avg_price'], reverse=True)

        # top/bottom districts
        top_districts = by_district[:5]
        bottom_districts = by_district[-5:][::-1]

        # timeseries: daily avg
        day_map = {}
        for p in filtered:
            try:
                if isinstance(p.created_at, datetime):
                    created = p.created_at
                else:
                    created = datetime.fromisoformat(p.created_at)

                if created is None:
                    continue
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                else:
                    created = created.astimezone(timezone.utc)
            except Exception:
                continue
            day = created.date().isoformat()
            if day not in day_map:
                day_map[day] = {'sum': 0.0, 'count': 0}
            day_map[day]['sum'] += float(p.predicted_price or 0.0)
            day_map[day]['count'] += 1
        timeseries = []
        for day, vals in sorted(day_map.items()):
            avg = vals['sum'] / vals['count'] if vals['count'] > 0 else 0.0
            timeseries.append({'date': day, 'avg': float(avg), 'count': vals['count']})

        # compute simple moving averages (7-day, 30-day) on timeseries
        def compute_ma(arr, window):
            result = []
            for i in range(len(arr)):
                start = max(0, i - window + 1)
                window_vals = [x['avg'] for x in arr[start:i+1]]
                result.append(float(np.mean(window_vals)) if window_vals else 0.0)
            return result

        ma7 = compute_ma(timeseries, 7) if timeseries else []
        ma30 = compute_ma(timeseries, 30) if timeseries else []
        timeseries_with_ma = []
        for i, item in enumerate(timeseries):
            timeseries_with_ma.append({
                'date': item['date'],
                'avg': item['avg'],
                'count': item['count'],
                'ma7': ma7[i] if i < len(ma7) else None,
                'ma30': ma30[i] if i < len(ma30) else None
            })

        # growth percent: compare first and last day averages
        growth_pct = 0.0
        if len(timeseries) >= 2:
            first = timeseries[0]['avg']
            last = timeseries[-1]['avg']
            try:
                growth_pct = float(((last - first) / first) * 100.0) if first != 0 else 0.0
            except Exception:
                growth_pct = 0.0

        # by_rooms: group by rooms_clean
        rooms_map = {}
        for p in filtered:
            rooms = int(p.rooms_clean or 0)
            if rooms not in rooms_map:
                rooms_map[rooms] = {'sum': 0.0, 'count': 0}
            rooms_map[rooms]['sum'] += float(p.predicted_price or 0.0)
            rooms_map[rooms]['count'] += 1
        by_rooms = []
        for rooms, vals in sorted(rooms_map.items()):
            avg = vals['sum'] / vals['count'] if vals['count'] > 0 else 0.0
            pct = (vals['count'] / total) * 100.0 if total > 0 else 0.0
            by_rooms.append({'rooms': rooms, 'avg_price': float(avg), 'count': vals['count'], 'pct': float(pct)})

        # price buckets (finer) and histogram
        max_price = float(np.max(prices))
        # define bins up to reasonable upper bound
        step = 10000
        bins = list(range(0, int(max(50000, max_price + step)) + step, step))
        bins.append(float('inf'))
        labels = []
        for i in range(len(bins)-1):
            if bins[i+1] == float('inf'):
                labels.append(f'>{int(bins[i])//1000}k')
            else:
                labels.append(f'{int(bins[i])//1000}-{int(bins[i+1])//1000}k')
        bucket_map = {label: {'sum': 0.0, 'count': 0} for label in labels}
        for p in filtered:
            price = float(p.predicted_price or 0.0)
            for i in range(len(bins)-1):
                upper = bins[i+1]
                if (upper == float('inf') and price >= bins[i]) or (bins[i] <= price < upper):
                    label = labels[i]
                    bucket_map[label]['sum'] += price
                    bucket_map[label]['count'] += 1
                    break
        price_buckets = []
        price_histogram = []
        for label in labels:
            cnt = bucket_map[label]['count']
            avg = bucket_map[label]['sum'] / cnt if cnt > 0 else 0.0
            price_buckets.append({'label': label, 'count': cnt, 'avg_price': float(avg)})
            price_histogram.append({'label': label, 'count': cnt})

        # percentiles
        try:
            p10, p25, p50, p75, p90 = [float(x) for x in np.percentile(prices, [10,25,50,75,90])]
        except Exception:
            p10 = p25 = p50 = p75 = p90 = 0.0
        percentiles = {'p10':p10,'p25':p25,'p50':p50,'p75':p75,'p90':p90}

        # recent predictions (last 10)
        recent_predictions = []
        for p in sorted(filtered, key=lambda x: x.created_at, reverse=True)[:10]:
            recent_predictions.append({'id': p.id, 'date': (p.created_at.isoformat() if hasattr(p.created_at, 'isoformat') else str(p.created_at)), 'predicted_price': float(p.predicted_price or 0.0)})

        return {
            'total_predictions': total,
            'price_stats': price_stats,
            'by_district': by_district,
            'top_districts': top_districts,
            'bottom_districts': bottom_districts,
            'timeseries': timeseries,
            'timeseries_with_ma': timeseries_with_ma,
            'by_rooms': by_rooms,
            'price_buckets': price_buckets,
            'price_histogram': price_histogram,
            'percentiles': percentiles,
            'growth_pct': float(growth_pct),
            'recent_predictions': recent_predictions,
            'last_update': datetime.now(timezone.utc).isoformat()
        }
