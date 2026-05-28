"""Debug script to test predictions and data flow."""
import sys
import os
sys.path.insert(0, '/app')

import asyncio
import numpy as np
from app.ml.model_loader import ModelLoader
from app.ml.simple_preprocessor import clean_rooms, preprocess_input, process_time_to_metro
from app.core.config import settings


async def debug_prediction():
    """Debug prediction with sample data."""
    
    # Load model
    model_dict = ModelLoader.get_model()
    model = model_dict['final_model']
    
    print("=" * 80)
    print("MODEL INFO:")
    print(f"  Model type: {type(model).__name__}")
    print(f"  CB Features count: {len(model_dict.get('cb_features', []))}")
    print(f"  Selected Features count: {len(model_dict.get('selected_features', []))}")
    print("=" * 80)
    
    # Test data
    test_data = {
        'region': 'Москва и МО',
        'address': 'Москва, ул. Примерная, 1',
        'square': 50.0,
        'floor': 2,
        'max_floor': 5,
        'metro': 'Красная площадь',
        'rooms': 2,
        'time': 10,
        'time_type': 'walk',
        'description': 'Комфортная квартира',
    }
    
    print("\nTEST DATA:", test_data)
    
    # Test clean_rooms
    print("\n" + "=" * 80)
    print("1. TESTING clean_rooms():")
    for rooms_val in [1, 2, '1', '2', 'studio', 'студия']:
        cleaned = clean_rooms(rooms_val)
        print(f"  clean_rooms({repr(rooms_val):10s}) = {cleaned}")
    
    # Test process_time_to_metro
    print("\n" + "=" * 80)
    print("2. TESTING process_time_to_metro():")
    for time_val, time_type in [(10, 'walk'), (10, 'bus'), (999, 'walk'), (5, 'transport')]:
        result = process_time_to_metro(time_val, time_type)
        print(f"  process_time_to_metro({time_val:3d}, {time_type:10s}) = {result:6.1f}")
    
    # Test prediction with rooms as int
    print("\n" + "=" * 80)
    print("3. TESTING PREDICTION WITH rooms=2 (int):")
    test_data['rooms'] = 2
    features = preprocess_input(test_data, model_dict)
    
    print(f"  Features shape: {features.shape}")
    print(f"  Non-null values: {features.notna().sum().sum()}")
    
    log_pred = float(model.predict(features)[0])
    raw_price = float(np.expm1(log_pred))
    calibrated = raw_price * settings.PRICE_CALIBRATION_FACTOR
    
    print(f"  Log prediction: {log_pred:.8f}")
    print(f"  Raw price (expm1): {raw_price:.2f} ₽")
    print(f"  Calibration factor: {settings.PRICE_CALIBRATION_FACTOR}")
    print(f"  FINAL PRICE: {calibrated:.2f} ₽")
    
    # Test with string rooms
    print("\n" + "=" * 80)
    print("4. TESTING PREDICTION WITH rooms='2' (str):")
    test_data['rooms'] = '2'
    features = preprocess_input(test_data, model_dict)
    
    log_pred2 = float(model.predict(features)[0])
    raw_price2 = float(np.expm1(log_pred2))
    calibrated2 = raw_price2 * settings.PRICE_CALIBRATION_FACTOR
    
    print(f"  Log prediction: {log_pred2:.8f}")
    print(f"  Raw price (expm1): {raw_price2:.2f} ₽")
    print(f"  FINAL PRICE: {calibrated2:.2f} ₽")
    
    # Compare
    print("\n" + "=" * 80)
    print("COMPARISON:")
    print(f"  Difference (int vs str): {abs(calibrated - calibrated2):.2f} ₽")
    print(f"  Expected prediction: 120000 ₽")
    print(f"  Notebook prediction: 106600 ₽")
    print(f"  Web prediction (old): 68220 ₽")
    print(f"  Web prediction (new): {calibrated:.2f} ₽")
    
    if raw_price > 0:
        needed_factor = 120000 / raw_price
        print(f"\n  To achieve 120000: factor should be {needed_factor:.4f}")
    
    print("\n" + "=" * 80)


if __name__ == '__main__':
    asyncio.run(debug_prediction())
