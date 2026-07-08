from __future__ import annotations

from app.domain.prompts.models import PromptTemplate, PromptVersion
from app.infrastructure.storage.prompt_template_store import PromptTemplateStore

_COMMON_CONTEXT_BLOCK = (
    "Tema: {{topic}}\nIdioma: {{language}}\nDuración objetivo: {{duration}} segundos\n"
    "Plataforma: {{platform}}\nCanal: {{workspace}}\nEstilo: {{style}}\n\n"
)

DEFAULT_TEMPLATES: list[dict] = [
    {
        "name": "Reddit Story ES",
        "content_type": "reddit_story",
        "system_prompt": (
            "Eres un narrador de historias de Reddit en español para videos cortos. "
            "Adaptas el hilo original a un guion oral, natural y con gancho desde el "
            "primer segundo."
        ),
        "user_prompt_template": (
            _COMMON_CONTEXT_BLOCK
            + "Narra esta historia de Reddit en tono conversacional, manteniendo el suspenso."
        ),
    },
    {
        "name": "Curiosidades ES",
        "content_type": "curiosidades",
        "system_prompt": (
            "Eres un guionista de datos curiosos en español, preciso y entretenido, "
            "para videos cortos verticales."
        ),
        "user_prompt_template": (
            _COMMON_CONTEXT_BLOCK
            + "Genera un guion con 3 a 5 datos curiosos sobre el tema, cada uno con un "
            "gancho de intriga antes de revelarlo."
        ),
    },
    {
        "name": "Misterio ES",
        "content_type": "misterio",
        "system_prompt": (
            "Eres un narrador de misterios en español, con tono inquietante y ritmo "
            "pausado, para videos cortos."
        ),
        "user_prompt_template": (
            _COMMON_CONTEXT_BLOCK
            + "Narra este misterio construyendo tensión progresiva hasta una revelación final."
        ),
    },
    {
        "name": "Historia ES",
        "content_type": "historia",
        "system_prompt": (
            "Eres un narrador de historia en español, riguroso factualmente pero "
            "accesible, para videos cortos educativos."
        ),
        "user_prompt_template": (
            _COMMON_CONTEXT_BLOCK
            + "Cuenta este episodio histórico de forma cronológica, resaltando su "
            "relevancia actual."
        ),
    },
    {
        "name": "Top List ES",
        "content_type": "top_list",
        "system_prompt": (
            "Eres un guionista de listas 'top N' en español, dinámico y con "
            "transiciones claras entre elementos, para videos cortos."
        ),
        "user_prompt_template": (
            _COMMON_CONTEXT_BLOCK
            + "Genera una lista ordenada (de menor a mayor impacto) relacionada con el "
            "tema, con una frase de cierre que invite a comentar."
        ),
    },
]


def seed_default_templates(store: PromptTemplateStore | None = None) -> list[str]:
    store = store or PromptTemplateStore()
    existing_names = {t.name for t in store.list_templates()}
    created_ids: list[str] = []
    for entry in DEFAULT_TEMPLATES:
        if entry["name"] in existing_names:
            continue
        template = PromptTemplate(
            name=entry["name"],
            content_type=entry["content_type"],
            language="es",
            system_prompt=entry["system_prompt"],
            user_prompt_template=entry["user_prompt_template"],
        )
        version = PromptVersion(
            template_id=template.id,
            version=1,
            system_prompt=entry["system_prompt"],
            user_prompt_template=entry["user_prompt_template"],
            active=True,
        )
        template.active_version_id = version.id
        store.save_template(template)
        store.save_version(version)
        created_ids.append(template.id)
    return created_ids
