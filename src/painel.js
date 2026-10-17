// O painel de configurações dos jogos (Gráfico e Som), igual em todos e pensado primeiro para o
// celular: folha que sobe do pé da tela no retrato, cartão no meio na paisagem e no computador,
// alvos de toque de 48 px, área segura do iPhone, vidro escuro no estilo do Call of Roque.
// DOM puro, sem Vue: o jogo monta num elemento dele e recebe as mudanças por callback.
//
// Pedido do fundador de 16/10/2026, 21h02: "os menus e HUD estão ruins, poderíamos melhorar
// bastante para jogar principalmente no mobile".

import { QUALIDADES, EFEITOS, FOV, efeitoLigado, trocarQualidade } from './grafico.js'
import { normalizarIdioma } from './idiomas.js'

/** Os textos do painel nos dez idiomas do RoqueOS. */
export const TEXTOS_DO_PAINEL = Object.freeze({
  'pt-BR': {
    titulo: 'Configurações',
    grafico: 'Gráfico',
    som: 'Som',
    fechar: 'Fechar',
    qualidade: 'Qualidade',
    efeitos: 'Efeitos',
    fov: 'Campo de visão',
    geral: 'Geral',
    efeitosSom: 'Efeitos',
    musica: 'Música',
    q: { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', ultra: 'Ultra' },
    e: {
      ao: 'Oclusão de ambiente',
      bloom: 'Brilho (bloom)',
      borrao: 'Borrão de movimento',
      aa: 'Antisserrilhado',
      vinheta: 'Vinheta',
    },
  },
  'en-US': {
    titulo: 'Settings',
    grafico: 'Graphics',
    som: 'Sound',
    fechar: 'Close',
    qualidade: 'Quality',
    efeitos: 'Effects',
    fov: 'Field of view',
    geral: 'Master',
    efeitosSom: 'Effects',
    musica: 'Music',
    q: { baixo: 'Low', medio: 'Medium', alto: 'High', ultra: 'Ultra' },
    e: {
      ao: 'Ambient occlusion',
      bloom: 'Bloom',
      borrao: 'Motion blur',
      aa: 'Anti-aliasing',
      vinheta: 'Vignette',
    },
  },
  'es-ES': {
    titulo: 'Ajustes',
    grafico: 'Gráficos',
    som: 'Sonido',
    fechar: 'Cerrar',
    qualidade: 'Calidad',
    efeitos: 'Efectos',
    fov: 'Campo de visión',
    geral: 'General',
    efeitosSom: 'Efectos',
    musica: 'Música',
    q: { baixo: 'Baja', medio: 'Media', alto: 'Alta', ultra: 'Ultra' },
    e: {
      ao: 'Oclusión ambiental',
      bloom: 'Resplandor',
      borrao: 'Desenfoque de movimiento',
      aa: 'Antialiasing',
      vinheta: 'Viñeta',
    },
  },
  'fr-FR': {
    titulo: 'Paramètres',
    grafico: 'Graphismes',
    som: 'Son',
    fechar: 'Fermer',
    qualidade: 'Qualité',
    efeitos: 'Effets',
    fov: 'Champ de vision',
    geral: 'Général',
    efeitosSom: 'Effets',
    musica: 'Musique',
    q: { baixo: 'Basse', medio: 'Moyenne', alto: 'Haute', ultra: 'Ultra' },
    e: {
      ao: 'Occlusion ambiante',
      bloom: 'Lueur',
      borrao: 'Flou de mouvement',
      aa: 'Anticrénelage',
      vinheta: 'Vignette',
    },
  },
  'de-DE': {
    titulo: 'Einstellungen',
    grafico: 'Grafik',
    som: 'Ton',
    fechar: 'Schließen',
    qualidade: 'Qualität',
    efeitos: 'Effekte',
    fov: 'Sichtfeld',
    geral: 'Gesamt',
    efeitosSom: 'Effekte',
    musica: 'Musik',
    q: { baixo: 'Niedrig', medio: 'Mittel', alto: 'Hoch', ultra: 'Ultra' },
    e: {
      ao: 'Umgebungsverdeckung',
      bloom: 'Bloom',
      borrao: 'Bewegungsunschärfe',
      aa: 'Kantenglättung',
      vinheta: 'Vignette',
    },
  },
  'ja-JP': {
    titulo: '設定',
    grafico: 'グラフィック',
    som: 'サウンド',
    fechar: '閉じる',
    qualidade: '品質',
    efeitos: 'エフェクト',
    fov: '視野角',
    geral: '全体',
    efeitosSom: '効果音',
    musica: '音楽',
    q: { baixo: '低', medio: '中', alto: '高', ultra: '最高' },
    e: {
      ao: 'アンビエントオクルージョン',
      bloom: 'ブルーム',
      borrao: 'モーションブラー',
      aa: 'アンチエイリアス',
      vinheta: 'ビネット',
    },
  },
  'zh-CN': {
    titulo: '设置',
    grafico: '画面',
    som: '声音',
    fechar: '关闭',
    qualidade: '画质',
    efeitos: '特效',
    fov: '视野',
    geral: '总音量',
    efeitosSom: '音效',
    musica: '音乐',
    q: { baixo: '低', medio: '中', alto: '高', ultra: '极致' },
    e: { ao: '环境光遮蔽', bloom: '泛光', borrao: '动态模糊', aa: '抗锯齿', vinheta: '暗角' },
  },
  'hi-IN': {
    titulo: 'सेटिंग्स',
    grafico: 'ग्राफ़िक्स',
    som: 'ध्वनि',
    fechar: 'बंद करें',
    qualidade: 'गुणवत्ता',
    efeitos: 'प्रभाव',
    fov: 'दृष्टि क्षेत्र',
    geral: 'मुख्य',
    efeitosSom: 'प्रभाव',
    musica: 'संगीत',
    q: { baixo: 'निम्न', medio: 'मध्यम', alto: 'उच्च', ultra: 'अल्ट्रा' },
    e: {
      ao: 'एम्बिएंट ऑक्लूज़न',
      bloom: 'ब्लूम',
      borrao: 'मोशन ब्लर',
      aa: 'एंटी-एलियासिंग',
      vinheta: 'विनेट',
    },
  },
  'ru-RU': {
    titulo: 'Настройки',
    grafico: 'Графика',
    som: 'Звук',
    fechar: 'Закрыть',
    qualidade: 'Качество',
    efeitos: 'Эффекты',
    fov: 'Поле зрения',
    geral: 'Общая',
    efeitosSom: 'Эффекты',
    musica: 'Музыка',
    q: { baixo: 'Низкое', medio: 'Среднее', alto: 'Высокое', ultra: 'Ультра' },
    e: {
      ao: 'Фоновое затенение',
      bloom: 'Свечение',
      borrao: 'Размытие движения',
      aa: 'Сглаживание',
      vinheta: 'Виньетка',
    },
  },
  'ar-AR': {
    titulo: 'الإعدادات',
    grafico: 'الرسومات',
    som: 'الصوت',
    fechar: 'إغلاق',
    qualidade: 'الجودة',
    efeitos: 'التأثيرات',
    fov: 'مجال الرؤية',
    geral: 'الرئيسي',
    efeitosSom: 'المؤثرات',
    musica: 'الموسيقى',
    q: { baixo: 'منخفضة', medio: 'متوسطة', alto: 'عالية', ultra: 'فائقة' },
    e: {
      ao: 'الإطباق المحيطي',
      bloom: 'التوهج',
      borrao: 'ضبابية الحركة',
      aa: 'تنعيم الحواف',
      vinheta: 'التظليل الجانبي',
    },
  },
})

export const textosDoPainel = (idioma) =>
  TEXTOS_DO_PAINEL[normalizarIdioma(idioma)] ?? TEXTOS_DO_PAINEL['en-US']

/** O CSS do painel, injetado uma vez por documento. Variáveis `--jogo-*` deixam cada jogo dar o tom. */
export const CSS_DO_PAINEL = `
.jogo-painel{position:absolute;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(4,6,10,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  font-family:var(--jogo-fonte,system-ui,-apple-system,"Segoe UI",sans-serif);color:#f4f1ea}
.jogo-painel__folha{width:100%;max-height:min(86vh,720px);overflow:auto;box-sizing:border-box;
  padding:16px 16px calc(16px + env(safe-area-inset-bottom));border-radius:22px 22px 0 0;
  background:linear-gradient(180deg,rgba(28,30,38,.96),rgba(14,15,20,.98));
  border:1px solid rgba(255,255,255,.08);box-shadow:0 -12px 40px rgba(0,0,0,.45)}
@media (min-width:720px),(orientation:landscape){.jogo-painel{align-items:center}
  .jogo-painel__folha{width:min(560px,92vw);border-radius:22px}}
.jogo-painel__topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.jogo-painel__titulo{font-size:20px;font-weight:700;letter-spacing:.02em}
.jogo-painel__fechar{min-width:48px;min-height:48px;border-radius:14px;border:0;background:rgba(255,255,255,.08);
  color:inherit;font-size:22px;cursor:pointer}
.jogo-painel__abas{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:14px;
  background:rgba(255,255,255,.06);margin-bottom:16px}
.jogo-painel__aba{min-height:44px;border:0;border-radius:11px;background:transparent;color:rgba(244,241,234,.7);
  font-weight:600;font-size:15px;cursor:pointer}
.jogo-painel__aba[aria-selected="true"]{background:var(--jogo-destaque,#e7b04a);color:#17130b}
.jogo-painel__secao{margin:0 0 18px}
.jogo-painel__rotulo{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(244,241,234,.55);margin:0 0 8px}
.jogo-painel__qualidades{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.jogo-painel__qualidade{min-height:52px;border-radius:12px;border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);color:inherit;font-weight:700;font-size:15px;cursor:pointer}
.jogo-painel__qualidade[aria-pressed="true"]{border-color:var(--jogo-destaque,#e7b04a);
  background:color-mix(in srgb,var(--jogo-destaque,#e7b04a) 22%,transparent);color:#fff}
.jogo-painel__linha{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;
  padding:0 4px;border-bottom:1px solid rgba(255,255,255,.06);font-size:16px}
.jogo-painel__chave{position:relative;width:52px;height:30px;flex:none;border-radius:16px;border:0;
  background:rgba(255,255,255,.18);cursor:pointer;transition:background .15s}
.jogo-painel__chave::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;
  background:#fff;transition:transform .15s}
.jogo-painel__chave[aria-checked="true"]{background:var(--jogo-destaque,#e7b04a)}
.jogo-painel__chave[aria-checked="true"]::after{transform:translateX(22px)}
.jogo-painel__faixa{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 12px;min-height:56px}
.jogo-painel__faixa input{grid-column:1/-1;width:100%;height:32px;accent-color:var(--jogo-destaque,#e7b04a)}
.jogo-painel__valor{font-variant-numeric:tabular-nums;color:rgba(244,241,234,.7)}
[dir="rtl"] .jogo-painel__chave[aria-checked="true"]::after{transform:translateX(-22px)}
@media (orientation:landscape) and (max-height:500px){
  .jogo-painel__folha{width:min(760px,94vw);max-height:94vh;padding:12px 14px}
  .jogo-painel__topo{margin-bottom:8px}.jogo-painel__abas{margin-bottom:10px}.jogo-painel__secao{margin-bottom:10px}
  .jogo-painel__secao--efeitos{display:grid;grid-template-columns:1fr 1fr;column-gap:18px}
  .jogo-painel__secao--efeitos .jogo-painel__rotulo{grid-column:1/-1}
  .jogo-painel__qualidade,.jogo-painel__linha{min-height:44px}}
`

function injetarCss(doc) {
  if (doc.getElementById('jogo-painel-css')) return
  const s = doc.createElement('style')
  s.id = 'jogo-painel-css'
  s.textContent = CSS_DO_PAINEL
  doc.head.appendChild(s)
}

/**
 * Abre o painel dentro de `raiz` (o elemento do jogo, com position relative). `som` é opcional:
 * { geral, efeitos, musica } de 0 a 1. Devolve { fechar, atualizar }.
 */
export function abrirPainel({
  raiz,
  idioma = 'pt-BR',
  cfg,
  aoMudarGrafico = () => {},
  som = null,
  aoMudarSom = () => {},
  aoFechar = () => {},
  aba: abaInicial = 'grafico',
}) {
  const doc = raiz.ownerDocument
  injetarCss(doc)
  const t = textosDoPainel(idioma)
  let estado = { ...cfg, efeitos: { ...(cfg?.efeitos ?? {}) } }
  let sons = som ? { ...som } : null
  let aba = abaInicial

  const fundo = doc.createElement('div')
  fundo.className = 'jogo-painel'
  fundo.setAttribute('role', 'dialog')
  fundo.setAttribute('aria-modal', 'true')
  fundo.setAttribute('aria-label', t.titulo)
  if (normalizarIdioma(idioma) === 'ar-AR') fundo.setAttribute('dir', 'rtl')
  const folha = doc.createElement('div')
  folha.className = 'jogo-painel__folha'
  fundo.appendChild(folha)

  const el = (tag, cls, texto) => {
    const e = doc.createElement(tag)
    if (cls) e.className = cls
    if (texto != null) e.textContent = texto
    return e
  }

  function montar() {
    folha.textContent = ''
    const topo = el('div', 'jogo-painel__topo')
    topo.append(el('div', 'jogo-painel__titulo', t.titulo))
    const x = el('button', 'jogo-painel__fechar', '✕')
    x.type = 'button'
    x.setAttribute('aria-label', t.fechar)
    x.dataset.acao = 'fechar'
    x.addEventListener('click', fechar)
    topo.append(x)
    folha.append(topo)

    if (sons) {
      const abas = el('div', 'jogo-painel__abas')
      abas.setAttribute('role', 'tablist')
      for (const [id, nome] of [
        ['grafico', t.grafico],
        ['som', t.som],
      ]) {
        const b = el('button', 'jogo-painel__aba', nome)
        b.type = 'button'
        b.setAttribute('role', 'tab')
        b.setAttribute('aria-selected', String(aba === id))
        b.dataset.aba = id
        b.addEventListener('click', () => {
          aba = id
          montar()
        })
        abas.append(b)
      }
      folha.append(abas)
    }
    if (aba === 'som' && sons) montarSom()
    else montarGrafico()
  }

  function montarGrafico() {
    const q = el('section', 'jogo-painel__secao')
    q.append(el('p', 'jogo-painel__rotulo', t.qualidade))
    const grade = el('div', 'jogo-painel__qualidades')
    for (const nome of QUALIDADES) {
      const b = el('button', 'jogo-painel__qualidade', t.q[nome])
      b.type = 'button'
      b.dataset.qualidade = nome
      b.setAttribute('aria-pressed', String(estado.qualidade === nome))
      b.addEventListener('click', () => {
        estado = trocarQualidade(estado, nome)
        aoMudarGrafico(estado)
        montar()
      })
      grade.append(b)
    }
    q.append(grade)
    folha.append(q)

    const e = el('section', 'jogo-painel__secao jogo-painel__secao--efeitos')
    e.append(el('p', 'jogo-painel__rotulo', t.efeitos))
    for (const nome of EFEITOS) {
      const linha = el('label', 'jogo-painel__linha')
      linha.append(el('span', null, t.e[nome]))
      const chave = el('button', 'jogo-painel__chave')
      chave.type = 'button'
      chave.setAttribute('role', 'switch')
      chave.setAttribute('aria-checked', String(efeitoLigado(estado, nome)))
      chave.setAttribute('aria-label', t.e[nome])
      chave.dataset.efeito = nome
      chave.addEventListener('click', () => {
        estado = { ...estado, efeitos: { ...estado.efeitos, [nome]: !efeitoLigado(estado, nome) } }
        aoMudarGrafico(estado)
        montar()
      })
      linha.append(chave)
      e.append(linha)
    }
    folha.append(e)

    if (Number.isFinite(estado.fov)) {
      folha.append(
        faixa(
          t.fov,
          estado.fov,
          FOV.min,
          FOV.max,
          1,
          (v) => `${Math.round(v)}°`,
          (v) => {
            estado = { ...estado, fov: v }
            aoMudarGrafico(estado)
          },
          'fov',
        ),
      )
    }
  }

  function montarSom() {
    const s = el('section', 'jogo-painel__secao')
    for (const [chave, nome] of [
      ['geral', t.geral],
      ['efeitos', t.efeitosSom],
      ['musica', t.musica],
    ]) {
      if (!Number.isFinite(sons[chave])) continue
      s.append(
        faixa(
          nome,
          sons[chave],
          0,
          1,
          0.05,
          (v) => `${Math.round(v * 100)}%`,
          (v) => {
            sons = { ...sons, [chave]: v }
            aoMudarSom(sons)
          },
          chave,
        ),
      )
    }
    folha.append(s)
  }

  function faixa(nome, valor, min, max, passo, mostrar, mudar, id) {
    const f = el('label', 'jogo-painel__faixa')
    const v = el('span', 'jogo-painel__valor', mostrar(valor))
    f.append(el('span', null, nome), v)
    const r = el('input')
    r.type = 'range'
    r.min = String(min)
    r.max = String(max)
    r.step = String(passo)
    r.value = String(valor)
    r.dataset.faixa = id
    r.addEventListener('input', () => {
      const n = Number(r.value)
      v.textContent = mostrar(n)
      mudar(n)
    })
    f.append(r)
    return f
  }

  function fechar() {
    fundo.remove()
    doc.removeEventListener('keydown', aoTeclar)
    aoFechar(estado, sons)
  }
  const aoTeclar = (ev) => {
    if (ev.key === 'Escape') fechar()
  }
  fundo.addEventListener('click', (ev) => {
    if (ev.target === fundo) fechar()
  })
  doc.addEventListener('keydown', aoTeclar)

  montar()
  raiz.appendChild(fundo)
  return {
    elemento: fundo,
    fechar,
    get cfg() {
      return estado
    },
    get som() {
      return sons
    },
  }
}
