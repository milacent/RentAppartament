"""Preprocessing to convert input fields to model features using CatBoost parameters."""
import numpy as np
import pandas as pd
from typing import Dict, Any
import re


def clean_rooms(rooms):
    """Clean and standardize room count from various formats."""
    if pd.isna(rooms) or rooms is None:
        return 1
    rooms = str(rooms).lower().strip()
    if 'студ' in rooms or 'studio' in rooms:
        return 0
    if 'свобод' in rooms or 'своб' in rooms:
        return 1
    numbers = re.findall(r'\d+', rooms)
    if numbers:
        return int(numbers[0])
    return 1


def process_time_to_metro(time_val, time_type='walk'):
    """Process time to metro with correction for bus travel."""
    # Handle None/NaN
    if time_val is None or (isinstance(time_val, float) and pd.isna(time_val)):
        return 15  # Default to 15 minutes
    
    try:
        time_val = float(time_val)
    except (ValueError, TypeError):
        return 15
    
    if time_val <= 0:
        return 15
    if time_val >= 999:
        return 999
    
    time_type = str(time_type or 'walk').lower()
    # Multiply by 2.5 if it's bus/transport, otherwise use as-is for walking
    if 'bus' in time_type or 'transport' in time_type:
        result = time_val * 2.5
    else:
        result = time_val
    
    # Cap at 999
    return min(result, 999)


def preprocess_input(data: Dict[str, Any], model_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Convert 10 input fields to model features matching CatBoost model requirements.

    Input fields:
    - region: str
    - address: str  
    - square: float
    - floor: int
    - max_floor: int
    - metro: str (station name)
    - rooms: int/str
    - time: int/float (minutes to metro)
    - time_type: str ('walk' or 'bus')
    - description: str (apartment description)

    Returns:
    - pandas.DataFrame with columns matching model's cb_features
    """
    
    cb_features = model_dict.get('cb_features') or model_dict.get('selected_features') or []

    # Get helper functions
    extract_city = model_dict.get('extract_city')
    extract_city_from_region = model_dict.get('extract_city_from_region') or extract_city
    strip_city_from_address = model_dict.get('strip_city_from_address')
    extract_street_type = model_dict.get('extract_street_type')
    clean_text = model_dict.get('clean_text')
    extract_keywords = model_dict.get('extract_keywords')
    is_central_metro = model_dict.get('is_central_metro')
    lemmatize = model_dict.get('lemmatize')
    russian_stopwords = model_dict.get('russian_stopwords', set())

    def normalize_region_value(region_value: str) -> str:
        if not region_value:
            return region_value
        region_norm = str(region_value).strip().lower().replace('ё', 'е')
        if region_norm in ('москва', 'москва и мо', 'московская область'):
            return 'Москва'
        if region_norm in ('санкт-петербург', 'санкт-петербург и ло', 'ленинградская область', 'спб'):
            return 'Санкт-Петербург'
        if region_norm in ('казань',):
            return 'Казань'
        if region_norm in ('екатеринбург',):
            return 'Екатеринбург'
        if region_norm in ('новосибирск',):
            return 'Новосибирск'
        if region_norm in ('нижний новгород',):
            return 'Нижний Новгород'
        if region_norm in ('краснодар',):
            return 'Краснодар'
        return str(region_value).strip()

    # Parse input with type logging
    region_raw = str(data.get('region', 'Москва и МО') or 'Москва и МО').strip()
    address = str(data.get('address', '') or '').strip()
    region = region_raw
    if extract_city_from_region:
        try:
            normalized_region = extract_city_from_region(region_raw)
            if normalized_region:
                region = normalized_region
        except:
            region = region_raw

    if region == region_raw:
        region = normalize_region_value(region_raw)
    
    # Safe float conversion for square
    try:
        square = float(data.get('square', 30.0) or 30.0)
        if square <= 0:
            square = 30.0
    except (ValueError, TypeError):
        square = 30.0
    
    # Safe int conversion for floor
    try:
        floor = int(float(str(data.get('floor', 1) or 1)))
        if floor <= 0:
            floor = 1
    except (ValueError, TypeError):
        floor = 1
    
    # Safe int conversion for max_floor
    try:
        max_floor = int(float(str(data.get('max_floor', 5) or 5)))
        if max_floor <= 0:
            max_floor = 5
    except (ValueError, TypeError):
        max_floor = 5
    
    metro_raw = data.get('metro')
    metro = str(metro_raw or 'no_metro').strip() if metro_raw else 'no_metro'

    # Clean rooms using proper logic
    rooms_raw = data.get('rooms', 1)
    rooms_clean = clean_rooms(rooms_raw)

    # Process time to metro with transport type correction
    time_val = data.get('time')
    time_type = str(data.get('time_type', 'walk') or 'walk').lower()
    time_to_metro = process_time_to_metro(time_val, time_type)

    description = str(data.get('description', '') or '').strip()

    # Calculate derived features
    has_metro = 0 if (metro == 'no_metro' or pd.isna(metro) or metro == '') else 1
    metro_very_far = 1 if time_to_metro >= 999 else 0
    is_first_floor = 1 if floor == 1 else 0
    is_last_floor = 1 if floor == max_floor else 0
    floor_ratio = floor / max(max_floor, 1)

    # Central metro check
    is_central = 0
    if is_central_metro and has_metro:
        try:
            is_central = 1 if is_central_metro(metro) else 0
        except:
            is_central = 0

    # Additional derived features
    rooms_per_square = rooms_clean / max(square, 1)
    square_x_rooms = square * rooms_clean
    log_square = np.log1p(square)
    price_per_sqm_estimate = square / max(rooms_clean, 1)

    # Extract city from region using model helper if available
    if extract_city_from_region:
        try:
            city = extract_city_from_region(region)
        except:
            city = region.split(' и ')[0] if ' и ' in region else region
    else:
        city = region.split(' и ')[0] if ' и ' in region else region

    address_tail = address
    if strip_city_from_address:
        try:
            address_tail = strip_city_from_address(address, region)
        except:
            address_tail = address

    # Extract street type from address tail
    street_type = 'unknown'
    if extract_street_type:
        try:
            street_type = extract_street_type(address_tail)
        except:
            street_type = 'unknown'

    # Clean and process description
    description_clean = description
    if clean_text and lemmatize:
        try:
            # Clean punctuation
            desc_clean = re.sub(r'[^а-яёa-z\s]', ' ', description.lower())
            desc_clean = re.sub(r'\s+', ' ', desc_clean).strip()
            # Remove stopwords and short words
            words = [w for w in desc_clean.split() if w not in russian_stopwords and len(w) > 2]
            description_clean_tokens = ' '.join(words)
            # Lemmatize
            description_clean = lemmatize(description_clean_tokens)
        except:
            description_clean = description

    # Extract keyword features
    keywords = extract_keywords(description) if extract_keywords else {}
    if not keywords:
        keywords = {
            'has_furniture': 0,
            'has_appliances': 0,
            'has_tv': 0,
            'has_wifi': 0,
            'has_dishwasher': 0,
            'has_washing_machine': 0,
            'renovation_euro': 0,
            'renovation_cosmetic': 0,
            'renovation_new': 0,
            'pets_allowed': 0,
            'children_allowed': 0,
            'has_parking': 0,
            'has_balcony': 0,
            'has_security': 0,
            'is_new_building': 0,
        }

    # Categorize features based on thresholds from notebook
    floor_category = 'first' if floor == 1 else ('low' if floor <= 5 else ('middle' if floor <= 10 else 'high'))
    building_height = 'low_rise' if max_floor <= 5 else ('mid_rise' if max_floor <= 9 else ('high_rise' if max_floor <= 16 else 'skyscraper'))
    size_category = 'tiny' if square <= 30 else ('small' if square <= 50 else ('medium' if square <= 70 else ('large' if square <= 100 else 'huge')))
    metro_accessibility = 'very_close' if time_to_metro <= 5 else ('close' if time_to_metro <= 10 else ('medium' if time_to_metro <= 15 else 'far'))

    # Build feature dict
    features = {
        'square': square,
        'floor': floor,
        'max_floor': max_floor,
        'rooms_clean': rooms_clean,
        'time_to_metro': time_to_metro,
        'metro_very_far': metro_very_far,
        'is_first_floor': is_first_floor,
        'is_last_floor': is_last_floor,
        'floor_ratio': floor_ratio,
        'has_metro': has_metro,
        'is_central': is_central,
        'rooms_per_square': rooms_per_square,
        'square_x_rooms': square_x_rooms,
        'log_square': log_square,
        'price_per_sqm_estimate': price_per_sqm_estimate,
        'region': region,
        'city': city,
        'metro': metro,
        'street_type': street_type,
        'description_clean': description_clean,
        'floor_category': floor_category,
        'building_height': building_height,
        'size_category': size_category,
        'metro_accessibility': metro_accessibility,
        **keywords,  # Unpack all keyword features
    }

    # Create dataframe with all features in correct order
    df_data = {}
    for fname in cb_features:
        df_data[fname] = features.get(fname, 0)

    df = pd.DataFrame([df_data])

    # Ensure categorical columns are strings
    cat_cols = ['region', 'city', 'metro', 'street_type', 'description_clean',
                'floor_category', 'building_height', 'size_category', 'metro_accessibility']
    for col in cat_cols:
        if col in df.columns:
            df[col] = df[col].astype(str)
    
    return df
