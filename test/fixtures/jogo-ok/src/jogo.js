// O jogo de exemplo do teste do SDK. Existe para o `jogo check` ter um src/ de
// verdade para ler; nunca roda. Quem guarda o progresso é o host, e por isso
// nada aqui importa banco.
import { definirJogo } from '@roqueos-games/jogo-sdk'

export default definirJogo({
  id: 'exemplo',
  capacidades: [],
  montar(el, host) {
    host.metricas.evento('abriu')
    return { desmontar() {} }
  },
})
