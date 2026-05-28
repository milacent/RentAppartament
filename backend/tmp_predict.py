import sys
from pathlib import Path
import builtins
import joblib
import numpy as np

sys.path.insert(0, str(Path('.').resolve()))

model_path = Path('app/rental_price_model.pkl')
if not model_path.exists():
    raise FileNotFoundError(f'Model file not found at {model_path}')

if '__builtin__' not in sys.modules:
    sys.modules['__builtin__'] = builtins

try:
    try:
        md = joblib.load(str(model_path))
    except Exception as e:
        import dill
        with open(model_path, 'rb') as f:
            md = dill.load(f)
finally:
    if '__builtin__' in sys.modules:
        sys.modules.pop('__builtin__', None)

from importlib.machinery import SourceFileLoader
preprocessor_path = Path('app/ml/simple_preprocessor.py')
preprocessor = SourceFileLoader('simple_preprocessor', str(preprocessor_path)).load_module()

sample1 = {
    'region': 'Moskva',
    'address': 'Moskva, CAO, r-n Basmanniy, ul. Pokrovka, 41S1',
    'square': 120,
    'floor': 4,
    'max_floor': 6,
    'metro': 'Kurskaya',
    'rooms': '4',
    'time': 10,
    'time_type': 'walk',
    'description': 'Na dlitelnyy srok Svetlaya prostoranaya 4-h komnatnaya kvartira v istoricheskom centre Moskvy v 12 min. hodyby ot m. Chistye prudy.'
}

sample2 = {
    'region': 'Moskva',
    'address': 'Moskva, CAO, r-n Presnensky, Leontevsky per., 6S2',
    'square': 55,
    'floor': 2,
    'max_floor': 6,
    'metro': 'Tverskaya',
    'rooms': '2',
    'time': 10,
    'time_type': 'walk',
    'description': 'Lot 18615. Stilnaya 2-komnatnaya kvartira v stalinskom dome.'
}

for name, sample_input in [('Sample 1 (120sqm, 4 rooms)', sample1), ('Sample 2 (55sqm, 2 rooms)', sample2)]:
    features = preprocessor.preprocess_input(sample_input, md)
    log_pred = float(md['final_model'].predict(features)[0])
    price_raw = np.expm1(log_pred)
    price_with_074 = price_raw * 0.743
    price_with_150 = price_raw * 1.50
    print(f'\n{name}:')
    print(f'  log_pred: {log_pred:.4f}')
    print(f'  price_raw: {price_raw:.0f} rub')
    print(f'  price * 0.743: {price_with_074:.0f} rub')
    print(f'  price * 1.50: {price_with_150:.0f} rub')

