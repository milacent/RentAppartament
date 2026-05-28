#!/usr/bin/env python3
import sys
sys.path.insert(0, '/app')

import pprint
from app.ml.model_loader import ModelLoader
from app.ml.simple_preprocessor import preprocess_input
from app.core.config import settings
import numpy as np

sample_input = {
    'region': 'Москва',
    'address': 'Москва, ЦАО, р-н Басманный, ул. Маросейка, 10/1С4',
    'square': 50,
    'floor': 2,
    'max_floor': 5,
    'metro': 'Китай-город',
    'rooms': '2',
    'time': 4,
    'time_type': 'walk',
    'description': '''Заселение в квартиру возможно с 1.07.  Показы возможны сейчас. 

Представляем вашему вниманию уютную двухкомнатную квартиру в историческом центре Москвы, расположенную на Китай-Городе.
Этот вариант прекрасно подойдет тем, кто мечтает жить в сердце столицы, наслаждаясь всеми преимуществами городской инфраструктуры и удобством расположения. 
Преимущества проживания: кирпичный дом, обеспечивающий тепло зимой и прохладу летом. Комфортное пространство: гостиная и спальня спланированы таким образом, чтобы обеспечить максимальное удобство для семьи или пары друзей. 
Ремонт: качественная отделка в стиле евростандарта. Ламинат и керамическая плитка на полу создают ощущение тепла и элегантности. Стены украшают светлые тона обоев, создающие атмосферу гармонии и покоя.
Особые удобства: санузел оснащен душевой кабинкой и отделан качественной плиткой. Это создает дополнительное чувство комфорта и уюта. 
Интерьер: кухонный гарнитур итальянского производства гармонично дополняют обеденная группа, удобные диваны и качественный спальный гарнитур. 
Мебель встроенного типа помогает оптимально организовать пространство. 
Современные технологии: телевизор, холодильник, стиральная машина, кондиционер обеспечивают высокий уровень комфорта в повседневной жизни. 
Наличие домофона добавляет дополнительный элемент безопасности. 
Транспортная доступность: метро находится всего в нескольких минутах ходьбы, что значительно упрощает передвижение по городу. 
Эта квартира сочетает в себе европейский стандарт качества ремонта и удобную инфраструктуру района, предлагая своим жильцам жизнь в самом центре Москвы с возможностью быстро добраться до всех значимых мест города. 
Если вы мечтаете о комфортной квартире с качественным ремонтом и развитой инфраструктурой, расположенной рядом с метро, тогда эта квартира ждет вас! 
Свяжитесь с нами для подробной консультации и возможности ознакомиться с квартирой лично.

Арт. 28618515''',
}

print('Loading model via ModelLoader.get_model()')
model_dict = ModelLoader.get_model()
print('Model keys:', list(model_dict.keys()))
for k in ('extract_city_from_region','strip_city_from_address','extract_street_type','extract_city'):
    print(k, k in model_dict)

print('\nPreprocessing input to features...')
features = preprocess_input(sample_input, model_dict)
print('Features columns:', list(features.columns))
print('Features sample:')
pp = pprint.PrettyPrinter(width=120)
pp.pprint(features.to_dict(orient='records'))

model = model_dict['final_model']
print('\nModel object type:', type(model))

print('\nRunning prediction...')
log_pred = float(model.predict(features)[0])
raw = float(np.expm1(log_pred))
cal = float(settings.PRICE_CALIBRATION_FACTOR)
calibrated = raw * cal
print('log_pred:', log_pred)
print('raw (expm1):', raw)
print('calibration factor:', cal)
print('calibrated:', calibrated)

print('\nDone')


print('\nNow running Colab-style predict_price using direct pickle load...')

import joblib
import dill
import re


def predict_price_colab(input_data):
    # load pickle (joblib then dill)
    p = '/app/app/rental_price_model.pkl'
    try:
        model_package = joblib.load(p)
    except Exception:
        with open(p, 'rb') as f:
            model_package = dill.load(f)

    model_c = model_package['final_model']
    cb_features = model_package['cb_features']
    stopwords_set = model_package.get('russian_stopwords', set())
    extract_city_from_region = model_package.get('extract_city_from_region')
    strip_city_from_address = model_package.get('strip_city_from_address')
    extract_street_type = model_package.get('extract_street_type')
    extract_keywords = model_package.get('extract_keywords')
    lemmatize = model_package.get('lemmatize')

    # rooms
    rooms_raw = str(input_data.get('rooms', '1')).lower()
    rooms_clean = 0 if 'студ' in rooms_raw else (1 if 'свобод' in rooms_raw else int(re.findall(r'\d+', rooms_raw)[0] if re.findall(r'\d+', rooms_raw) else 1))

    time_val = input_data.get('time')
    metro_raw = input_data.get('metro', 'no_metro')
    metro = 'no_metro' if metro_raw is None or str(metro_raw).strip() == '' else str(metro_raw)
    has_metro = 0 if metro == 'no_metro' or metro is None else 1

    if time_val is None:
        time_to_metro = 999
    else:
        if 'bus' in str(input_data.get('time_type', '')).lower():
           time_to_metro = float(time_val) * 2.5
        else:
            time_to_metro = float(time_val)

    metro_very_far = 1 if time_to_metro >= 999 else 0

    floor = input_data.get('floor', 1)
    max_floor = input_data.get('max_floor', 5)
    square = input_data.get('square', 30)
    region = str(input_data.get('region', 'Москва и МО'))
    city = extract_city_from_region(region) if extract_city_from_region else (region.split(' и ')[0] if ' и ' in region else region)

    address = input_data.get('address', '')
    address_tail = strip_city_from_address(address, region) if strip_city_from_address else address

    is_central_metro = model_package.get('is_central_metro')

    description = input_data.get('description', '')
    desc_clean = re.sub(r'\s+', ' ', re.sub(r'[^а-яёa-z\s]', ' ', str(description).lower())).strip()
    description_clean_tokens = ' '.join([w for w in desc_clean.split() if w not in stopwords_set and len(w) > 2])
    description_clean = lemmatize(description_clean_tokens) if lemmatize else description_clean_tokens

    text_features_dict = extract_keywords(description) if extract_keywords else {}

    features_dict = {
        'square': square,
        'floor': floor,
        'max_floor': max_floor,
        'rooms_clean': rooms_clean,
        'time_to_metro': time_to_metro,
        'metro_very_far': metro_very_far,
        'is_first_floor': 1 if floor == 1 else 0,
        'is_last_floor': 1 if floor == max_floor else 0,
        'floor_ratio': floor / (max_floor + 1),
        'has_metro': has_metro,
        'is_central': is_central_metro(metro) if is_central_metro else 0,
        'rooms_per_square': rooms_clean / (square + 1),
        'square_x_rooms': square * rooms_clean,
        'log_square': np.log1p(square),
        'price_per_sqm_estimate': square / (rooms_clean + 1),

        'region': str(input_data.get('region', 'Москва и МО')),
        'city': city,
        'street_type': extract_street_type(address_tail) if extract_street_type else 'unknown',
        'metro': metro,

        'floor_category': 'first' if floor==1 else ('low' if floor<=5 else ('middle' if floor<=10 else 'high')),
        'building_height': 'low_rise' if max_floor<=5 else ('mid_rise' if max_floor<=9 else ('high_rise' if max_floor<=16 else 'skyscraper')),
        'size_category': 'tiny' if square<=30 else ('small' if square<=50 else ('medium' if square<=70 else ('large' if square<=100 else 'huge'))),
        'metro_accessibility': 'very_close' if time_to_metro<=5 else ('close' if time_to_metro<=10 else ('medium' if time_to_metro<=15 else 'far')),

        'description_clean': description_clean,
        **text_features_dict,
    }

    import pandas as pd
    X_pred_full = pd.DataFrame([features_dict])[cb_features]
    prediction_log = model_c.predict(X_pred_full)[0]
    return round(np.expm1(prediction_log), -2)

try:
    colab_pred = predict_price_colab(sample_input)
    print('Colab-style predict_price result:', colab_pred)
except Exception as e:
    print('Colab-style direct predict failed:', e)

print('\nComparison: backend calibrated vs colab-style')
print('backend calibrated:', round(calibrated, 0))
print('colab direct: aborted or failed')


print('\nNow running Colab-style predict but forcing local helper implementations...')

CITY_BY_REGION = {
    'москва': 'Москва',
    'москва и мо': 'Москва',
    'московская область': 'Москва',
    'санкт-петербург': 'Санкт-Петербург',
    'санкт-петербург и ло': 'Санкт-Петербург',
    'ленинградская область': 'Санкт-Петербург',
    'казань': 'Казань',
    'екатеринбург': 'Екатеринбург',
    'новосибирск': 'Новосибирск',
    'нижний новгород': 'Нижний Новгород',
    'краснодар': 'Краснодар',
}

def normalize_text(s):
    return str(s or '').strip().lower().replace('ё', 'е')

def extract_city_from_region_local(region):
    region_norm = normalize_text(region)
    if not region_norm:
        return 'Unknown'
    if region_norm in CITY_BY_REGION:
        return CITY_BY_REGION[region_norm]
    for key, city in CITY_BY_REGION.items():
        if key in region_norm:
            return city
    return str(region).strip() if str(region or '').strip() else 'Unknown'

KNOWN_CITY_VARIANTS = [
    'москва','санкт-петербург','спб','казань','екатеринбург','новосибирск','нижний новгород','краснодар'
]

def strip_city_from_address_local(address, region=None):
    import pandas as pd
    if pd.isna(address):
        return ''
    source = str(address).strip()
    if not source:
        return ''
    region_city = normalize_text(extract_city_from_region_local(region))
    parts = [p.strip() for p in source.split(',') if p.strip()]
    if not parts:
        return source
    first = normalize_text(parts[0])
    if first == region_city or first in KNOWN_CITY_VARIANTS:
        tail = ', '.join(parts[1:]).strip()
        return tail if tail else source
    return source

def predict_price_colab_with_local_helpers(input_data):
    # load model package
    p = '/app/app/rental_price_model.pkl'
    try:
        model_package = joblib.load(p)
    except Exception:
        with open(p, 'rb') as f:
            model_package = dill.load(f)
    model_c = model_package['final_model']
    cb_features = model_package['cb_features']
    stopwords_set = model_package.get('russian_stopwords', set())
    extract_street_type = model_package.get('extract_street_type')
    extract_keywords = model_package.get('extract_keywords')
    lemmatize = model_package.get('lemmatize')

    # replicate Colab feature building but use local helpers
    import re, pandas as pd
    rooms_raw = str(input_data.get('rooms', '1')).lower()
    rooms_clean = 0 if 'студ' in rooms_raw else (1 if 'свобод' in rooms_raw else int(re.findall(r'\d+', rooms_raw)[0] if re.findall(r'\d+', rooms_raw) else 1))
    time_val = input_data.get('time')
    metro_raw = input_data.get('metro', 'no_metro')
    metro = 'no_metro' if metro_raw is None or str(metro_raw).strip() == '' else str(metro_raw)
    has_metro = 0 if metro == 'no_metro' or metro is None else 1
    if time_val is None:
        time_to_metro = 999
    else:
        if 'bus' in str(input_data.get('time_type', '')).lower():
           time_to_metro = float(time_val) * 2.5
        else:
            time_to_metro = float(time_val)
    floor = input_data.get('floor', 1)
    max_floor = input_data.get('max_floor', 5)
    square = input_data.get('square', 30)
    region = str(input_data.get('region', 'Москва и МО'))
    city = extract_city_from_region_local(region)
    address = input_data.get('address', '')
    address_tail = strip_city_from_address_local(address, region)
    description = input_data.get('description', '')
    desc_clean = re.sub(r'\s+', ' ', re.sub(r'[^а-яёa-z\s]', ' ', str(description).lower())).strip()
    description_clean_tokens = ' '.join([w for w in desc_clean.split() if w not in stopwords_set and len(w) > 2])
    description_clean = lemmatize(description_clean_tokens) if lemmatize else description_clean_tokens
    text_features_dict = extract_keywords(description) if extract_keywords else {}
    features_dict = {
        'square': square,'floor': floor,'max_floor': max_floor,'rooms_clean': rooms_clean,
        'time_to_metro': time_to_metro,'metro_very_far': 1 if time_to_metro>=999 else 0,'is_first_floor': 1 if floor==1 else 0,
        'is_last_floor': 1 if floor==max_floor else 0,'floor_ratio': floor/(max_floor+1),'has_metro': has_metro,
        'is_central': model_package.get('is_central_metro')(metro) if model_package.get('is_central_metro') else 0,
        'rooms_per_square': rooms_clean/(square+1),'square_x_rooms': square*rooms_clean,'log_square': np.log1p(square),'price_per_sqm_estimate': square/(rooms_clean+1),
        'region': region,'city': city,'street_type': extract_street_type(address_tail) if extract_street_type else 'unknown','metro': metro,
        'floor_category': 'first' if floor==1 else ('low' if floor<=5 else ('middle' if floor<=10 else 'high')),
        'building_height': 'low_rise' if max_floor<=5 else ('mid_rise' if max_floor<=9 else ('high_rise' if max_floor<=16 else 'skyscraper')),
        'size_category': 'tiny' if square<=30 else ('small' if square<=50 else ('medium' if square<=70 else ('large' if square<=100 else 'huge'))),
        'metro_accessibility': 'very_close' if time_to_metro<=5 else ('close' if time_to_metro<=10 else ('medium' if time_to_metro<=15 else 'far')),
        'description_clean': description_clean, **text_features_dict,
    }
    import pandas as pd
    X_pred_full = pd.DataFrame([features_dict])[cb_features]
    prediction_log = model_c.predict(X_pred_full)[0]
    return round(np.expm1(prediction_log), -2)

colab_local_pred = predict_price_colab_with_local_helpers(sample_input)
print('Colab-style with local helpers predict:', colab_local_pred)
