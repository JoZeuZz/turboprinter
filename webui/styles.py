STREAMLIT_STYLE = """
<style>
h1 {
    padding-top: 0 !important;
}

/* Font gallery: flechas centradas en el stVerticalBlock de la columna */
div[data-testid="stVerticalBlock"]:has(.font-gallery-arrow-col) {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    min-height: 220px !important;
    height: 100% !important;
}

div[data-testid="stVerticalBlock"]:has(.voice-gallery-arrow-col) {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    min-height: 205px !important;
    height: 100% !important;
}

/* Font gallery: keyed containers expose stable st-key-* classes in Streamlit. */
[class*="st-key-font_card_"] {
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

[class*="st-key-font_card_selected_"] {
    border: 2px solid #39FF14 !important;
    box-shadow: 0 0 0 1px #39FF14, 0 0 18px rgba(57, 255, 20, 0.38) !important;
    background: rgba(57, 255, 20, 0.045) !important;
}

[class*="st-key-font_card_selected_"] button {

    box-shadow: 0 0 10px rgba(57, 255, 20, 0.18) !important;
}

.font-card-preview img {
    background: transparent !important;
}

[class*="st-key-voice_card_"] {
    min-height: 205px;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

[class*="st-key-voice_card_selected_"] {
    border: 2px solid #39FF14 !important;
    box-shadow: 0 0 0 1px #39FF14, 0 0 18px rgba(57, 255, 20, 0.3) !important;
    background: rgba(57, 255, 20, 0.035) !important;
}

.voice-card-name {
    margin-bottom: 0.4rem;
    font-size: 1rem;
    font-weight: 650;
}

.voice-card-copy {
    min-height: 3.5rem;
    color: rgba(250, 250, 250, 0.72);
    font-size: 0.82rem;
    line-height: 1.35rem;
}

.voice-card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.5rem 0 0.8rem;
}

.voice-card-badge {
    padding: 0.15rem 0.45rem;
    border: 1px solid rgba(250, 250, 250, 0.16);
    border-radius: 999px;
    background: rgba(250, 250, 250, 0.055);
    font-size: 0.72rem;
    line-height: 1rem;
}

.voice-gallery-page {
    margin-top: 0.6rem;
    color: rgba(250, 250, 250, 0.55);
    font-size: 0.78rem;
    text-align: center;
}

[class*="st-key-voice_preview_player"] {
    display: none !important;
}

.subtitle-control-label {
    margin-bottom: 0.35rem;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.25rem;
    text-align: center;
}
</style>
"""
