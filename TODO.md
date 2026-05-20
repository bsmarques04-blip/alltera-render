# TODO - Drawer de filtros do mapa (UX)

## Passos
- [ ] Atualizar `templates/mapa.html`: criar `.map-filters-trigger`, `.map-filters-overlay`, `.map-filters-panel` e mover o conteúdo de `.map-toolbar` para o painel.
- [ ] Atualizar `static/css/styles.css`: adicionar estilos do drawer (overlay, painel, trigger, responsivo, sem blur pesado).
- [ ] Atualizar `static/js/mapa.js`: adicionar lógica mínima de open/close (toggle da classe `.open`, ESC e clique fora) sem tocar na lógica dos filtros.
- [ ] Validar manualmente:
  - [ ] /mapa abre sem toolbar visível
  - [ ] abrir/fechar filtros funciona
  - [ ] resetFilters funciona
  - [ ] aplicação de filtros continua
  - [ ] mobile usável

