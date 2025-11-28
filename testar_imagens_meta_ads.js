/**
 * Script de teste para verificar se imagem_meta_ads está sendo retornada pela API
 */

import fetch from "node-fetch";

const STRAPI_TOKEN =
  "c23794ebbaef70d9284661dfa4d8590038f9f0244770f0ee463ec2c507faf8a6a175a6a730f3cd1ab5ff5018879722d412120332e35a7b5b785a25c190eca55719575bdc8ce882babebce93498a45fb3d44f0e72e27022c364058bb209fffa999c9edd6e3d92d6108f9f48df81a2d1421da3fa3a1edf00dc04056dfb743b5e4f";

async function testarImagensMetaAds() {
  console.log("🔍 Testando se imagem_meta_ads está sendo retornada pela API...\n");

  // Buscar com paginação
  let cursosPagina = [];
  let pagina = 1;
  let temMaisPaginas = true;
  
  while (temMaisPaginas) {
    const url = `https://cms-site.grupointegrado.br/api/curso-paginas?populate=*&pagination[page]=${pagina}&pagination[pageSize]=100`;
    
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
      });

      if (!response.ok) {
        console.error("❌ Erro:", response.status);
        break;
      }

      const json = await response.json();
      const paginaAtual = json.data || [];
      cursosPagina = cursosPagina.concat(paginaAtual);
      
      const paginacao = json.meta?.pagination;
      if (paginacao) {
        temMaisPaginas = pagina < paginacao.pageCount;
        console.log(`   📄 Página ${pagina}/${paginacao.pageCount} - ${paginaAtual.length} curso-páginas`);
      } else {
        temMaisPaginas = paginaAtual.length > 0;
      }
      
      pagina++;
    } catch (error) {
      console.error("❌ Erro:", error.message);
      break;
    }
  }

  console.log(`\n✅ Total de curso-páginas encontrados: ${cursosPagina.length}\n`);

  // Verificar quais têm imagem_meta_ads
  const comImagemMetaAds = [];
  const semImagemMetaAds = [];

  cursosPagina.forEach((cp) => {
    const attrs = cp.attributes;
    const imagemMetaAdsData = attrs.imagem_meta_ads?.data;
    
    if (imagemMetaAdsData) {
      const imagemMetaAds = Array.isArray(imagemMetaAdsData) && imagemMetaAdsData.length > 0
        ? imagemMetaAdsData[0]?.attributes
        : imagemMetaAdsData?.attributes;
      
      if (imagemMetaAds?.url) {
        comImagemMetaAds.push({
          id: cp.id,
          titulo: attrs.titulo,
          url: attrs.url,
          imagemUrl: imagemMetaAds.url,
          quantidade: Array.isArray(imagemMetaAdsData) ? imagemMetaAdsData.length : 1
        });
      }
    } else {
      semImagemMetaAds.push({
        id: cp.id,
        titulo: attrs.titulo
      });
    }
  });

  console.log(`📊 RESUMO:\n`);
  console.log(`   ✅ COM imagem_meta_ads: ${comImagemMetaAds.length}`);
  console.log(`   ❌ SEM imagem_meta_ads: ${semImagemMetaAds.length}\n`);

  if (comImagemMetaAds.length > 0) {
    console.log(`🎯 CURSO-PÁGINAS COM imagem_meta_ads:\n`);
    comImagemMetaAds.forEach((cp, index) => {
      console.log(`${index + 1}. ID: ${cp.id} - ${cp.titulo}`);
      console.log(`   URL: ${cp.url}`);
      console.log(`   📸 Imagem: ${cp.imagemUrl}`);
      console.log(`   📊 Quantidade de imagens: ${cp.quantidade}`);
      console.log("");
    });
  } else {
    console.log(`⚠️ NENHUM curso-página tem imagem_meta_ads populado!\n`);
    console.log(`💡 Verifique se:`);
    console.log(`   1. As imagens foram adicionadas no campo "imagem_meta_ads" no Strapi`);
    console.log(`   2. Os curso-páginas foram SALVOS`);
    console.log(`   3. Os curso-páginas estão PUBLICADOS`);
  }

  // Mostrar alguns exemplos dos que não têm
  if (semImagemMetaAds.length > 0 && semImagemMetaAds.length <= 10) {
    console.log(`\n📋 Curso-páginas SEM imagem_meta_ads (primeiros 10):\n`);
    semImagemMetaAds.slice(0, 10).forEach((cp, index) => {
      console.log(`${index + 1}. ID: ${cp.id} - ${cp.titulo}`);
    });
  }
}

testarImagensMetaAds();

