import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validarManifesto, ETIQUETAS } from '../src/index.js'

const base = () =>
  JSON.parse(readFileSync(new URL('./fixtures/jogo-ok/jogo.json', import.meta.url), 'utf8'))

describe('validarManifesto', () => {
  test('o manifesto do jogo de exemplo passa', () => {
    assert.deepEqual(validarManifesto(base()), [])
  })

  test('nome sem um dos dez idiomas reprova e diz qual', () => {
    const m = base()
    delete m.nome['ar-AR']
    assert.deepEqual(validarManifesto(m), ['nome sem texto em: ar-AR'])
  })

  test('idioma que a casa não fala também reprova', () => {
    const m = base()
    m.descricao['ko-KR'] = 'x'
    assert.match(validarManifesto(m)[0], /ko-KR/)
  })

  test('resumo de SEO acima do limite do buscador reprova', () => {
    const m = base()
    m.seo['en-US'].resumo = 'a'.repeat(161)
    assert.match(validarManifesto(m)[0], /161 caracteres/)
  })

  test('SEO em pt-BR e en-US é obrigatório; os outros oito caem no en-US', () => {
    const m = base()
    delete m.seo['pt-BR']
    assert.deepEqual(validarManifesto(m), ['seo.pt-BR ausente'])
  })

  test('etiqueta que a galeria não sabe desenhar reprova', () => {
    const m = base()
    m.etiquetas = ['Puzzle', 'Battle Royale']
    assert.match(validarManifesto(m)[0], /Battle Royale/)
  })

  test('as etiquetas batem com as chaves games.tag* do RoqueOS', () => {
    for (const e of ETIQUETAS) assert.match(`games.tag${e}`, /^games\.tag[0-9A-Z]/)
  })

  test('entrar no Pódio sem recorde não faz sentido', () => {
    const m = base()
    m.recorde = null
    assert.deepEqual(validarManifesto(m), ['entraNoPodio sem recorde: o Pódio compara o quê?'])
  })

  test('capacidades só lista opcionais; obrigatória ali é engano', () => {
    const m = base()
    m.capacidades = ['placar']
    assert.match(validarManifesto(m)[0], /as obrigatórias o host sempre dá/)
  })

  test('sala entra em capacidades, com convite aceito', () => {
    const m = base()
    m.capacidades = ['sala']
    m.aceitaConvite = true
    assert.deepEqual(validarManifesto(m), [])
  })

  // O link e o QR do convite só abrem o jogo no RoqueOS quando o manifesto
  // diz aceitaConvite. Sem isso o convidado cai no desktop e para ali.
  test('sala sem aceitaConvite reprova: o convite não abriria o jogo', () => {
    const m = base()
    m.capacidades = ['sala']
    m.aceitaConvite = false
    assert.deepEqual(validarManifesto(m), [
      'capacidades tem sala e aceitaConvite é false: o link do convite abriria o RoqueOS sem abrir o jogo',
    ])
  })

  test('slug e id no formato', () => {
    const m = base()
    m.slug = 'Jogo Da Velha'
    m.id = 'velha-3d'
    const p = validarManifesto(m)
    assert.equal(p.length, 2)
  })

  test('booleano dito com todas as letras', () => {
    const m = base()
    delete m.aceitaConvite
    assert.match(validarManifesto(m)[0], /aceitaConvite/)
  })

  test('versão do contrato diferente reprova', () => {
    const m = base()
    m.versaoDoContrato = 2
    assert.match(validarManifesto(m)[0], /este SDK fala o 1/)
  })

  test('lixo não passa', () => {
    assert.deepEqual(validarManifesto(null), ['jogo.json não é um objeto'])
  })
})
