import builtins
import re
import sys
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings
from app.core.exceptions import InternalServerError
from app.utils.logger import logger


class ModelLoader:
    """Load and cache the rental price model."""

    _model_dict = None
    _model_path = None

    @classmethod
    def load_model(cls) -> Dict[str, Any]:
        """Load model from disk once and keep it in memory."""
        if cls._model_dict is None:
            try:
                model_path = Path(settings.MODEL_PATH)
                if not model_path.exists():
                    raise FileNotFoundError(f"Model not found at {settings.MODEL_PATH}")

                cls._model_dict = cls._load_pickle(model_path)
                cls._model_path = model_path
                cls._validate_model_dict()
                cls._patch_model_function_globals()

                logger.info(
                    "Model loaded successfully. Features: "
                    f"{len(cls._model_dict['selected_features'])}"
                )
                logger.info(
                    "CB Features sample: "
                    f"{cls._model_dict['cb_features'][:10] if cls._model_dict['cb_features'] else 'None'}"
                )
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                raise InternalServerError(f"Failed to load model: {str(e)}")

        return cls._model_dict

    @classmethod
    def get_model(cls) -> Dict[str, Any]:
        return cls.load_model()

    @classmethod
    def _load_pickle(cls, model_path: Path) -> Dict[str, Any]:
        added_builtin_alias = False
        try:
            if "__builtin__" not in sys.modules:
                sys.modules["__builtin__"] = builtins
                added_builtin_alias = True

            try:
                return joblib.load(str(model_path))
            except Exception as joblib_error:
                logger.warning(
                    f"joblib.load failed ({joblib_error}), trying dill.load fallback"
                )
                import dill

                with model_path.open("rb") as file:
                    return dill.load(file)
        finally:
            if added_builtin_alias:
                sys.modules.pop("__builtin__", None)

    @classmethod
    def _validate_model_dict(cls) -> None:
        if "final_model" not in cls._model_dict:
            raise ValueError("Model missing 'final_model' key")
        if "cb_features" not in cls._model_dict:
            raise ValueError("Model missing 'cb_features' key")

        cls._model_dict["selected_features"] = cls._model_dict.get("cb_features", [])

        fallback_helpers = {
            "russian_stopwords": set(),
            "lemmatize": lambda x: x,
            "clean_text": lambda x: x,
            "extract_keywords": lambda x: {},
            "extract_city": lambda x: "Unknown",
            "extract_street_type": lambda x: "unknown",
            "is_central_metro": lambda x: 0,
        }

        for key, fallback in fallback_helpers.items():
            if key not in cls._model_dict:
                logger.warning(f"Model missing '{key}' - using fallback")
                cls._model_dict[key] = fallback

    @classmethod
    def _patch_model_function_globals(cls) -> None:
        """Restore globals needed by helper functions serialized inside pickle."""
        common_globals = {
            "pd": pd,
            "np": np,
            "re": re,
        }
        for key in (
            "clean_text",
            "extract_city",
            "extract_keywords",
            "extract_street_type",
            "is_central_metro",
            "lemmatize",
        ):
            func = cls._model_dict.get(key)
            func_globals = getattr(func, "__globals__", None)
            if func_globals is not None:
                func_globals.update(common_globals)
