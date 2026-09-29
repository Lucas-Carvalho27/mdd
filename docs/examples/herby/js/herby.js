// Os comportamentos da página dos tutoriais da Herby: carrosséis, abas, imagem ampliada,
// sumário que acompanha a leitura e botões de copiar. Tudo é acréscimo: sem este script, a
// página continua completa (os componentes estão descritos no topo do css/herby.css).
// O conteúdo dos <template data-perfis> não aparece na página, e fica de fora de tudo aqui.
;(() => {
  'use strict'

  document.documentElement.classList.add('js')

  const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)')
  const comportamento = () => (movimentoReduzido.matches ? 'auto' : 'smooth')

  let sequencia = 0
  const novoId = (prefixo) => `${prefixo}-${++sequencia}`

  /** Os filhos que aparecem na página: sem os <template>. */
  const filhosVisiveis = (pai) => [...pai.children].filter((filho) => filho.tagName !== 'TEMPLATE')

  function criar(tag, classe, atributos = {}) {
    const elemento = document.createElement(tag)
    if (classe) elemento.className = classe
    for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor)
    return elemento
  }

  function botao(classe, rotulo, texto = '') {
    const elemento = criar('button', classe, { type: 'button' })
    if (rotulo) elemento.setAttribute('aria-label', rotulo)
    elemento.textContent = texto
    return elemento
  }

  // Carrossel: os filhos são os slides; o script põe as setas, os pontos e o teclado.

  function montarCarrossel(trilho) {
    const slides = filhosVisiveis(trilho)
    if (slides.length < 2) return
    const telas = trilho.classList.contains('telas')
    const bloco = criar('div', telas ? 'carrossel-bloco telas' : 'carrossel-bloco')
    trilho.replaceWith(bloco)
    bloco.append(trilho)

    trilho.setAttribute('role', 'region')
    trilho.setAttribute('aria-roledescription', 'carrossel')
    trilho.tabIndex = 0
    if (!trilho.hasAttribute('aria-label')) {
      trilho.setAttribute('aria-label', telas ? 'Telas do celular' : 'Carrossel')
    }
    slides.forEach((slide, indice) => {
      if (slide.tagName === 'IMG') return
      slide.setAttribute('role', 'group')
      slide.setAttribute('aria-roledescription', 'slide')
      slide.setAttribute('aria-label', `${indice + 1} de ${slides.length}`)
    })

    const anterior = botao('botao-redondo seta-anterior', 'Anterior')
    const proxima = botao('botao-redondo seta-proxima', 'Próximo')
    const pontos = criar('div', 'carrossel-pontos')
    const contador = criar('span', 'carrossel-contador', { 'aria-live': 'polite' })
    const botoesPontos = slides.map((_, indice) => {
      const ponto = botao('carrossel-ponto', `Ir para ${indice + 1} de ${slides.length}`)
      ponto.addEventListener('click', () => irPara(indice))
      pontos.append(ponto)
      return ponto
    })
    const controles = criar('div', 'carrossel-controles')
    controles.append(anterior, pontos, contador, proxima)
    bloco.append(controles)

    let atual = 0
    const atualizar = () => {
      anterior.disabled = atual === 0
      proxima.disabled = atual === slides.length - 1
      botoesPontos.forEach((ponto, indice) => ponto.setAttribute('aria-current', String(indice === atual)))
      contador.textContent = `${atual + 1} de ${slides.length}`
    }
    const irPara = (indice) => {
      const alvo = slides[Math.max(0, Math.min(indice, slides.length - 1))]
      trilho.scrollTo({ left: alvo.offsetLeft - slides[0].offsetLeft, behavior: comportamento() })
    }

    anterior.addEventListener('click', () => irPara(atual - 1))
    proxima.addEventListener('click', () => irPara(atual + 1))
    trilho.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') {
        evento.preventDefault()
        irPara(atual + (evento.key === 'ArrowRight' ? 1 : -1))
      }
    })

    // O slide atual é o que está quase todo à vista dentro do trilho.
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) atual = slides.indexOf(entrada.target)
        }
        atualizar()
      },
      { root: trilho, threshold: 0.6 }
    )
    slides.forEach((slide) => observador.observe(slide))
    atualizar()
  }

  // Abas: cada filho é um painel, com o título tirado do seu <h5> ou <h6>.

  function montarAbas(caixa) {
    const paineis = filhosVisiveis(caixa)
    if (paineis.length < 2) return
    const lista = criar('div', 'abas-lista', { role: 'tablist' })
    const abas = paineis.map((painel, indice) => {
      const titulo = painel.querySelector(':scope > :is(h5, h6)')
      const aba = botao('aba', '', titulo ? titulo.textContent.trim() : `Parte ${indice + 1}`)
      aba.id = novoId('aba')
      aba.setAttribute('role', 'tab')
      if (!painel.id) painel.id = novoId('painel')
      aba.setAttribute('aria-controls', painel.id)
      painel.setAttribute('role', 'tabpanel')
      painel.setAttribute('aria-labelledby', aba.id)
      painel.tabIndex = 0
      aba.addEventListener('click', () => escolher(indice))
      lista.append(aba)
      return aba
    })

    const escolher = (indice, focar = false) => {
      abas.forEach((aba, i) => {
        const ativa = i === indice
        aba.setAttribute('aria-selected', String(ativa))
        aba.tabIndex = ativa ? 0 : -1
        paineis[i].hidden = !ativa
      })
      if (focar) abas[indice].focus()
      abas[indice].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: comportamento() })
    }

    lista.addEventListener('keydown', (evento) => {
      const atual = abas.indexOf(document.activeElement)
      if (atual < 0) return
      const destino = {
        ArrowRight: (atual + 1) % abas.length,
        ArrowLeft: (atual - 1 + abas.length) % abas.length,
        Home: 0,
        End: abas.length - 1
      }[evento.key]
      if (destino === undefined) return
      evento.preventDefault()
      escolher(destino, true)
    })

    caixa.prepend(lista)
    caixa.classList.add('pronta')
    // Sem scrollIntoView na montagem: a página não deve rolar sozinha ao abrir.
    abas.forEach((aba, i) => {
      aba.setAttribute('aria-selected', String(i === 0))
      aba.tabIndex = i === 0 ? 0 : -1
      paineis[i].hidden = i !== 0
    })
    caixa.escolherAba = (painel) => escolher(paineis.indexOf(painel))
  }

  // A imagem ampliada: um <dialog> para todas as imagens do conteúdo.

  function montarZoom() {
    const imagens = [...document.querySelectorAll('main img')]
    if (imagens.length === 0) return

    const dialogo = criar('dialog', 'zoom', { 'aria-label': 'Imagem ampliada' })
    const quadro = criar('div', 'zoom-quadro')
    const grande = criar('img', '', { alt: '' })
    const legenda = criar('p', 'zoom-legenda')
    const fechar = botao('botao-redondo zoom-fechar', 'Fechar')
    const anterior = botao('botao-redondo seta-anterior zoom-anterior', 'Imagem anterior')
    const proxima = botao('botao-redondo seta-proxima zoom-proxima', 'Próxima imagem')
    quadro.append(grande)
    dialogo.append(quadro, legenda, anterior, proxima, fechar)
    document.body.append(dialogo)

    let grupo = []
    let posicao = 0
    const legendaDe = (imagem) =>
      imagem.closest('figure')?.querySelector('figcaption')?.textContent.trim() || imagem.alt
    const mostrar = (indice) => {
      posicao = Math.max(0, Math.min(indice, grupo.length - 1))
      const imagem = grupo[posicao]
      grande.src = imagem.currentSrc || imagem.src
      grande.alt = imagem.alt
      legenda.textContent =
        grupo.length > 1 ? `${legendaDe(imagem)}  (${posicao + 1} de ${grupo.length})` : legendaDe(imagem)
      anterior.hidden = proxima.hidden = grupo.length < 2
      anterior.disabled = posicao === 0
      proxima.disabled = posicao === grupo.length - 1
    }
    const abrir = (imagem) => {
      // As imagens da mesma feature (sem as das filhas), para passar de uma para outra.
      const seletor = 'section[id]:not([class])'
      const feature = imagem.closest(seletor) ?? document.querySelector('main')
      grupo = [...feature.querySelectorAll('img')].filter(
        (outra) => outra.closest(seletor) === imagem.closest(seletor) && outra.getClientRects().length > 0
      )
      if (!grupo.includes(imagem)) grupo = [imagem]
      mostrar(grupo.indexOf(imagem))
      dialogo.showModal()
      fechar.focus()
    }

    for (const imagem of imagens) {
      imagem.classList.add('ampliavel')
      imagem.tabIndex = 0
      imagem.setAttribute('role', 'button')
      imagem.setAttribute('aria-label', `Ampliar: ${imagem.alt}`)
      imagem.addEventListener('click', () => abrir(imagem))
      imagem.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault()
          abrir(imagem)
        }
      })
    }

    fechar.addEventListener('click', () => dialogo.close())
    anterior.addEventListener('click', () => mostrar(posicao - 1))
    proxima.addEventListener('click', () => mostrar(posicao + 1))
    grande.addEventListener('click', () => dialogo.close())
    quadro.addEventListener('click', (evento) => {
      if (evento.target === quadro) dialogo.close()
    })
    dialogo.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft') mostrar(posicao - 1)
      if (evento.key === 'ArrowRight') mostrar(posicao + 1)
    })
    dialogo.addEventListener('close', () => grupo[posicao]?.focus({ preventScroll: true }))
  }

  // O sumário marca a seção que está sendo lida.

  function acompanharSumario() {
    const agenda = document.querySelector('.agenda')
    const links = [...document.querySelectorAll('.sumario a[href^="#"]')]
    const linkDe = new Map(links.map((link) => [decodeURIComponent(link.hash.slice(1)), link]))
    const secoes = [...linkDe.keys()].map((id) => document.getElementById(id)).filter(Boolean)
    if (secoes.length === 0) return
    const naFaixa = new Set()
    let ativo = null

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) naFaixa.add(entrada.target)
          else naFaixa.delete(entrada.target)
        }
        // As seções são aninhadas: vale a última, na ordem da página, que cruza a faixa.
        const secao = secoes.filter((candidata) => naFaixa.has(candidata)).pop()
        const link = secao && linkDe.get(secao.id)
        if (!link || link === ativo) return
        ativo?.classList.remove('ativo')
        ativo?.removeAttribute('aria-current')
        link.classList.add('ativo')
        link.setAttribute('aria-current', 'location')
        ativo = link
        // No sumário fixo e com rolagem própria, o link ativo fica à vista.
        if (agenda && agenda.scrollHeight > agenda.clientHeight + 4) {
          const topo = link.offsetTop - agenda.clientHeight / 3
          agenda.scrollTo({ top: Math.max(0, topo), behavior: comportamento() })
        }
      },
      { rootMargin: '-18% 0px -72% 0px' }
    )
    secoes.forEach((secao) => observador.observe(secao))
  }

  // Copiar: .copiavel ganha o botão dentro; [data-copiar], logo depois.

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      // Num quadro isolado (a aba Páginas do app), a área de transferência pode ser negada.
    }
    const area = criar('textarea', '', { readonly: '' })
    area.value = texto
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    let copiou = false
    try {
      copiou = document.execCommand('copy')
    } catch {
      copiou = false
    }
    area.remove()
    return copiou
  }

  function montarCopiar() {
    const alvos = document.querySelectorAll('.copiavel, [data-copiar]')
    for (const alvo of alvos) {
      const texto = (alvo.dataset.copiar || alvo.textContent).trim()
      if (texto === '') continue
      const copiar = botao('copiar', `Copiar ${texto}`, 'Copiar')
      let espera = 0
      let valor = alvo
      copiar.addEventListener('click', async () => {
        const copiou = await copiarTexto(texto)
        copiar.textContent = copiou ? 'Copiado' : 'Use Ctrl+C'
        copiar.dataset.estado = copiou ? 'ok' : 'erro'
        if (!copiou) {
          // Sem acesso à área de transferência: o texto fica selecionado para copiar à mão.
          const intervalo = document.createRange()
          intervalo.selectNodeContents(valor)
          getSelection().removeAllRanges()
          getSelection().addRange(intervalo)
        }
        clearTimeout(espera)
        espera = setTimeout(() => {
          copiar.textContent = 'Copiar'
          delete copiar.dataset.estado
        }, 2200)
      })
      if (alvo.classList.contains('copiavel')) {
        valor = criar('span')
        valor.append(...alvo.childNodes)
        alvo.append(valor, copiar)
      } else {
        alvo.after(copiar)
      }
    }
  }

  // Um link para um trecho escondido (numa aba, numa sanfona fechada) abre o trecho antes.

  function revelar(id) {
    const alvo = id ? document.getElementById(id) : null
    if (!alvo) return
    const painel = alvo.closest('[role="tabpanel"]')
    const caixa = painel?.parentElement
    if (painel?.hidden && caixa?.escolherAba) {
      caixa.escolherAba(painel)
    }
    const detalhes = alvo.closest('details')
    if (detalhes) detalhes.open = true
    requestAnimationFrame(() => alvo.scrollIntoView({ block: 'start' }))
  }

  document.querySelectorAll('.carrossel').forEach(montarCarrossel)
  document.querySelectorAll('.abas').forEach(montarAbas)
  montarZoom()
  acompanharSumario()
  montarCopiar()
  addEventListener('hashchange', () => revelar(decodeURIComponent(location.hash.slice(1))))
  if (location.hash.length > 1) revelar(decodeURIComponent(location.hash.slice(1)))
})()
