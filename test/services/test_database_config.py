import importlib


def test_database_enabled_by_default(monkeypatch):
    monkeypatch.delenv("TURBOPRINTER_DATABASE_ENABLED", raising=False)
    from app.config import config

    importlib.reload(config)
    assert config.database_enabled is True


def test_database_disabled_via_env(monkeypatch):
    monkeypatch.setenv("TURBOPRINTER_DATABASE_ENABLED", "false")
    from app.config import config

    importlib.reload(config)
    assert config.database_enabled is False
    monkeypatch.delenv("TURBOPRINTER_DATABASE_ENABLED", raising=False)
    importlib.reload(config)


def test_database_backend_defaults_to_sqlite():
    from app.config import config

    assert config.database_backend == "sqlite"


def test_database_sqlite_path_default():
    from app.config import config

    assert config.database.get("sqlite_path", "storage/app.db") == "storage/app.db"
