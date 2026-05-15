# TODO - Popup premium de clusters (Alltera)

- [ ] Atualizar `PlataformaApoioDecisaoComercial/static/js/mapa.js`: substituir `clusterPopupHtml(cluster)` pela versão pretendida (lista compacta, apenas nome, todas as leads, fallback “Lead sem nome”, sem cards vazios).
- [ ] Atualizar `PlataformaApoioDecisaoComercial/static/css/styles.css`: adicionar/ajustar CSS para `cluster-popup`, `cluster-leads-list`, `cluster-lead-item`, `cluster-popup__footer`, `cluster-expand-button` e overrides Leaflet (scroll correto + footer fixo no fundo).
- [ ] Validar rapidamente no browser: abrir popup de cluster com múltiplas leads e confirmar que:
  - nomes aparecem (e fallback quando falta);
  - nunca aparece card/campos vazios;
  - lista tem scroll vertical;
  - botão “Expandir área” fica no fundo e o popup não cresce descontroladamente.

