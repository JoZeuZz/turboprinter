from app.services import project_store


def test_save_and_load_project_preserves_content():
    conn = project_store.connect(":memory:")
    project_store.save_project(
        conn,
        "project-1",
        subject="Historia de terror",
        script="Una casa abandonada escondía una habitación sellada.",
        terms=["casa", "noche"],
        params={"voice_name": "es-ES-ElviraNeural"},
        status="draft",
    )

    saved = project_store.get_project(conn, "project-1")

    assert saved.subject == "Historia de terror"
    assert saved.terms == ["casa", "noche"]
    assert saved.params["voice_name"] == "es-ES-ElviraNeural"


def test_previous_scripts_matches_normalized_topic_and_excludes_current():
    conn = project_store.connect(":memory:")
    project_store.save_project(
        conn, "one", subject="Historia de terror", script="Primera historia"
    )
    project_store.save_project(
        conn, "two", subject="HISTÓRIA DE TERROR!", script="Segunda historia"
    )

    scripts = project_store.previous_scripts(
        conn, "historia de terror", exclude_project_id="two"
    )

    assert scripts == ["Primera historia"]


def test_normalize_subject_preserves_non_latin_topics():
    assert project_store.normalize_subject("恐怖故事") == "恐怖故事"
    assert project_store.normalize_subject("История ужасов") == "история ужасов"


def test_similarity_detects_rephrased_duplicate_but_not_new_story():
    original = (
        "Una mujer entra en una casa abandonada y descubre que el espejo "
        "repite sus movimientos con varios segundos de retraso."
    )
    duplicate = (
        "Una mujer entra a una casa abandonada y descubre que el espejo "
        "repite sus movimientos con unos segundos de retraso."
    )
    different = (
        "Un pescador recibe llamadas desde un faro que lleva cincuenta años apagado."
    )

    assert project_store.script_similarity(original, duplicate) >= 0.72
    assert project_store.script_similarity(original, different) < 0.72


def test_save_project_updates_without_losing_existing_params():
    conn = project_store.connect(":memory:")
    project_store.save_project(
        conn, "one", subject="Tema", params={"font_name": "Roboto.ttf"}
    )

    project_store.save_project(
        conn, "one", subject="Tema", script="Nuevo guion", status="generating"
    )

    saved = project_store.get_project(conn, "one")
    assert saved.script == "Nuevo guion"
    assert saved.params == {"font_name": "Roboto.ttf"}
