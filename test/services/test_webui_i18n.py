import ast
import json
from pathlib import Path
import unittest


ROOT_DIR = Path(__file__).parent.parent.parent
WEBUI_MAIN = ROOT_DIR / "webui" / "Main.py"
I18N_DIR = ROOT_DIR / "webui" / "i18n"


class _TrKeyVisitor(ast.NodeVisitor):
    def __init__(self):
        self.keys = set()

    def visit_Call(self, node):
        if (
            isinstance(node.func, ast.Name)
            and node.func.id == "tr"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            self.keys.add(node.args[0].value)
        self.generic_visit(node)


def _load_translation(locale):
    data = json.loads((I18N_DIR / f"{locale}.json").read_text(encoding="utf-8"))
    return data.get("Translation", {})


class TestWebuiI18n(unittest.TestCase):
    def test_font_gallery_applies_persisted_selection_to_render_params(self):
        tree = ast.parse(WEBUI_MAIN.read_text(encoding="utf-8"))
        render_font_gallery = next(
            node
            for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "render_font_gallery"
        )

        assignments = [
            node
            for node in ast.walk(render_font_gallery)
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Attribute)
                and isinstance(target.value, ast.Name)
                and target.value.id == "params"
                and target.attr == "font_name"
                for target in node.targets
            )
            and isinstance(node.value, ast.Name)
            and node.value.id == "selected"
        ]

        self.assertEqual(len(assignments), 1)

    def test_spanish_locale_covers_static_webui_labels(self):
        tree = ast.parse(WEBUI_MAIN.read_text(encoding="utf-8"))
        visitor = _TrKeyVisitor()
        visitor.visit(tree)

        es_keys = set(_load_translation("es"))

        self.assertEqual(sorted(visitor.keys - es_keys), [])

    def test_spanish_navigation_and_publish_labels_are_translated(self):
        translations = _load_translation("es")
        expected = {
            "Script": "Guion",
            "Publish": "Publicar",
            "Upload / Post": "Publicación",
            "Enable Upload-Post": "Activar publicación",
            "Auto upload after generation": (
                "Publicar automáticamente después de generar"
            ),
        }

        for key, value in expected.items():
            self.assertEqual(translations.get(key), value)

    def test_english_locale_covers_static_webui_labels(self):
        tree = ast.parse(WEBUI_MAIN.read_text(encoding="utf-8"))
        visitor = _TrKeyVisitor()
        visitor.visit(tree)

        en_keys = set(_load_translation("en"))

        self.assertEqual(sorted(visitor.keys - en_keys), [])

    def test_russian_locale_covers_english_locale(self):
        en_keys = set(_load_translation("en"))
        ru_keys = set(_load_translation("ru"))

        self.assertEqual(sorted(en_keys - ru_keys), [])

    def test_russian_locale_covers_static_webui_labels(self):
        tree = ast.parse(WEBUI_MAIN.read_text(encoding="utf-8"))
        visitor = _TrKeyVisitor()
        visitor.visit(tree)

        ru_keys = set(_load_translation("ru"))

        self.assertEqual(sorted(visitor.keys - ru_keys), [])

    def test_script_language_options_include_russian(self):
        tree = ast.parse(WEBUI_MAIN.read_text(encoding="utf-8"))
        support_locales = None

        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            if any(
                isinstance(target, ast.Name) and target.id == "support_locales"
                for target in node.targets
            ):
                support_locales = ast.literal_eval(node.value)
                break

        self.assertIsNotNone(support_locales)
        self.assertIn("ru-RU", support_locales)

    def test_script_language_options_include_spanish(self):
        tree = ast.parse(WEBUI_MAIN.read_text(encoding="utf-8"))
        support_locales = None

        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            if any(
                isinstance(target, ast.Name) and target.id == "support_locales"
                for target in node.targets
            ):
                support_locales = ast.literal_eval(node.value)
                break

        self.assertIsNotNone(support_locales)
        self.assertIn("es-ES", support_locales,
                      "es-ES must be in support_locales (fork is Spanish-focused)")
