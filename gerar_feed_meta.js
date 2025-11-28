/**
 * Gera automaticamente um feed CSV compatível com o Meta Ads (Facebook/Instagram)
 * usando banners, cursos e curso-páginas do Strapi (CMS do Grupo Integrado)
 * 
 * Campos incluídos: id, title, description, availability, condition, price,
 * link, image_link, brand, category, additional_image_link,
 * availability_circle_origin.latitude, availability_circle_origin.longitude,
 * availability_circle_radius, availability_circle_radius_unit, availability_postal_codes
 */

import fs from "fs";
import fetch from "node-fetch";

const STRAPI_BANNERS_URL = "https://cms-site.grupointegrado.br/api/home?populate[banner][populate]=*";
const STRAPI_CURSOS_URL = "https://cms-site.grupointegrado.br/api/cursos?populate=*";
const STRAPI_CURSOS_PAGINA_URL = "https://cms-site.grupointegrado.br/api/curso-paginas?populate[imagem_meta_ads][populate]=*&populate[imagem_banner][populate]=*";
const STRAPI_TOKEN =
  "c23794ebbaef70d9284661dfa4d8590038f9f0244770f0ee463ec2c507faf8a6a175a6a730f3cd1ab5ff5018879722d412120332e35a7b5b785a25c190eca55719575bdc8ce882babebce93498a45fb3d44f0e72e27022c364058bb209fffa999c9edd6e3d92d6108f9f48df81a2d1421da3fa3a1edf00dc04056dfb743b5e4f";

/**
 * Escapa valores CSV e adiciona aspas quando necessário
 */
function escapeCsvValue(value) {
  if (value == null) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Determina a categoria baseada no nome do curso e modalidade
 */
function determinarCategoria(nome, modalidade) {
  if (!nome) return "Educação";
  const nomeLower = nome.toLowerCase();
  
  // Categorias específicas por curso
  if (nomeLower.includes("medicina")) return "Educação > Medicina";
  if (nomeLower.includes("odontologia")) return "Educação > Odontologia";
  if (nomeLower.includes("enfermagem")) return "Educação > Enfermagem";
  if (nomeLower.includes("nutrição")) return "Educação > Nutrição";
  if (nomeLower.includes("biomedicina")) return "Educação > Biomedicina";
  if (nomeLower.includes("veterinária")) return "Educação > Veterinária";
  if (nomeLower.includes("direito")) return "Educação > Direito";
  if (nomeLower.includes("administração")) return "Educação > Administração";
  if (nomeLower.includes("agronomia") || nomeLower.includes("agronegócio")) return "Educação > Agronomia";
  if (nomeLower.includes("engenharia")) return "Educação > Engenharia";
  if (nomeLower.includes("tecnologia") || nomeLower.includes("tecn.")) return "Educação > Tecnologia";
  
  // Categoria por modalidade
  if (modalidade && modalidade.toLowerCase().includes("ead")) return "Educação > EAD";
  
  return "Educação > Graduação";
}

/**
 * Determina códigos postais de cobertura baseado no curso
 */
function determinarCodigosPostais(alt, link) {
  const altLower = (alt || "").toLowerCase();
  const linkLower = (link || "").toLowerCase();

  // Medicina Macapá - códigos postais da região de Macapá/AP
  if (altLower.includes("macapá") || linkLower.includes("macapa")) {
    return "68900-000,68901-000,68902-000,68903-000,68904-000,68905-000,68906-000,68907-000,68908-000,68909-000";
  }

  // Campo Mourão e região - códigos postais do Paraná
  return "87300-000,87301-000,87302-000,87303-000,87304-000,87305-000,87306-000,87307-000,87308-000,87309-000";
}

/**
 * Determina coordenadas (latitude,longitude) e raio
 */
function determinarCoordenadas(alt, link) {
  const altLower = (alt || "").toLowerCase();
  const linkLower = (link || "").toLowerCase();

  // Medicina Macapá tem localização específica
  if (altLower.includes("macapá") || linkLower.includes("macapa")) {
    return { origin: "0.0389,-51.0664", radius: "80" }; // Macapá, AP
  }

  // Todos os outros cursos são em Campo Mourão (padrão)
  return { origin: "-24.0433,-52.3781", radius: "80" }; // Campo Mourão, PR
}

/**
 * Formata o raio no padrão exigido pela Meta, limitando a 80 km
 */
function formatarRaio(valor) {
  const numero = Number(String(valor).replace(/[^0-9.]/g, ""));
  const limitado = isNaN(numero) ? 0 : Math.min(Math.max(numero, 1), 80);
  return limitado.toString();
}

async function gerarFeedMeta() {
  console.log("🔄 Buscando banners e curso-páginas do Strapi...");

  try {
    // Buscar banners
    const bannersResponse = await fetch(STRAPI_BANNERS_URL, {
      headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    });

    if (!bannersResponse.ok) {
      console.error("❌ Erro ao acessar banners do Strapi:", bannersResponse.status);
    }

    const bannersJson = await bannersResponse.json();
    const banners = bannersJson.data?.attributes?.banner || [];

    // Buscar curso-paginas com paginação (Strapi retorna 25 por página por padrão)
    // Usar populate explícito para garantir que todas as imagens sejam retornadas
    let cursosPagina = [];
    let pagina = 1;
    let temMaisPaginas = true;
    
    while (temMaisPaginas) {
      // Usar populate explícito para imagem_meta_ads sem limite
      const urlComPaginacao = `https://cms-site.grupointegrado.br/api/curso-paginas?populate[imagem_meta_ads][populate][*]=*&populate[imagem_banner][populate][*]=*&pagination[page]=${pagina}&pagination[pageSize]=100`;
      const cursosPaginaResponse = await fetch(urlComPaginacao, {
        headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
      });

      if (!cursosPaginaResponse.ok) {
        console.error("❌ Erro ao acessar curso-paginas do Strapi:", cursosPaginaResponse.status);
        break;
      }

      const cursosPaginaJson = await cursosPaginaResponse.json();
      const paginaAtual = cursosPaginaJson.data || [];
      cursosPagina = cursosPagina.concat(paginaAtual);
      
      // Verificar se há mais páginas
      const paginacao = cursosPaginaJson.meta?.pagination;
      if (paginacao) {
        temMaisPaginas = pagina < paginacao.pageCount;
        console.log(`   📄 Página ${pagina}/${paginacao.pageCount} - ${paginaAtual.length} curso-páginas`);
      } else {
        temMaisPaginas = paginaAtual.length > 0;
      }
      
      pagina++;
    }

    // Filtrar curso-paginas que têm imagem_banner ou imagem_meta_ads
    const cursosPaginaComImagem = cursosPagina.filter(cp => 
      cp.attributes?.imagem_banner?.data || cp.attributes?.imagem_meta_ads?.data
    );

    console.log(`✅ ${banners.length} banners + ${cursosPaginaComImagem.length} curso-paginas encontrados.`);

    // Formato oficial do Meta: coordenadas separadas por latitude/longitude
    const csvHeader =
      "id,title,description,availability,condition,price,link,image_link,brand,google_product_category,additional_image_link,availability_circle_origin.latitude,availability_circle_origin.longitude,availability_circle_radius,availability_circle_radius_unit,availability_postal_codes";
    const csvRows = [csvHeader];

    // Processar banners
    banners.forEach((banner, index) => {
      try {
        const id = `banner_${banner.id || index}`;
        const title = banner.alt || "Curso Grupo Integrado";
        const description = `${banner.alt || "Curso"} - Grupo Integrado. Educação de qualidade e tradição.`;

        let link = banner.link || "https://www.grupointegrado.br";
        if (!link.startsWith("http")) {
          link = `https://www.grupointegrado.br${link}`;
        }

        const availability = "in stock";
        const condition = "new";
        const price = "0.00 BRL";
        const brand = "Grupo Integrado";
        const category = determinarCategoria(title, "");
        const coordenadas = determinarCoordenadas(title, link);
        const postalCodes = determinarCodigosPostais(title, link);

        // Imagens
        const desktop = banner.desktop?.data?.attributes?.url;
        const mobile = banner.mobile?.data?.attributes?.url;
        const image_link = desktop
          ? (desktop.startsWith("http") ? desktop : `https://cms-site.grupointegrado.br${desktop}`)
          : mobile
          ? (mobile.startsWith("http") ? mobile : `https://cms-site.grupointegrado.br${mobile}`)
          : "";
        const additional_image_link =
          desktop && mobile && mobile !== desktop
            ? (mobile.startsWith("http") ? mobile : `https://cms-site.grupointegrado.br${mobile}`)
            : "";

        // Separar coordenadas em latitude e longitude (formato oficial do Meta)
        const [latitude, longitude] = coordenadas.origin.split(',').map(coord => parseFloat(coord.trim()).toFixed(6));
        const radiusFormatted = formatarRaio(coordenadas.radius);

         const csvRow = [
           escapeCsvValue(id),
           escapeCsvValue(title),
           escapeCsvValue(description),
           availability,
           condition,
           price,
           escapeCsvValue(link),
           escapeCsvValue(image_link),
           escapeCsvValue(brand),
           escapeCsvValue(category),
           escapeCsvValue(additional_image_link),
          escapeCsvValue(latitude),
          escapeCsvValue(longitude),
          escapeCsvValue(radiusFormatted.replace(' km', '')),
          "km",
           escapeCsvValue(postalCodes),
         ].join(",");

        csvRows.push(csvRow);
      } catch (error) {
        console.warn(`⚠️ Erro ao processar banner ${banner.id || index}:`, error.message);
      }
    });

    // Processar curso-paginas
    cursosPaginaComImagem.forEach((cursoPagina, index) => {
      try {
        const attrs = cursoPagina.attributes;
        
        const baseId = `curso-pagina_${cursoPagina.id || index}`;
        const title = attrs.titulo || "Curso Grupo Integrado";
        const tipoCurso = attrs.tipo_curso || "";
        const modalidade = attrs.Modalidade || "Graduação";
        const description = `${title} - ${tipoCurso} - Grupo Integrado. Educação de qualidade e tradição.`;

        // Link do curso-pagina
        let link = attrs.url || "https://www.grupointegrado.br";
        if (!link.startsWith("http")) {
          link = `https://www.grupointegrado.br${link}`;
        }

        const availability = "in stock";
        const condition = "new";
        const price = "0.00 BRL";
        const brand = "Grupo Integrado";
        const category = determinarCategoria(title, tipoCurso);
        const coordenadas = determinarCoordenadas(title, link);
        const postalCodes = determinarCodigosPostais(title, link);

        // Separar coordenadas em latitude e longitude (formato oficial do Meta)
        const [latitude, longitude] = coordenadas.origin.split(',').map(coord => parseFloat(coord.trim()).toFixed(6));
        const radiusFormatted = formatarRaio(coordenadas.radius);

        // Processar imagem_meta_ads - criar uma linha para CADA imagem
        const imagemMetaAdsData = attrs.imagem_meta_ads?.data;
        const bannerData = attrs.imagem_banner?.data?.attributes;
        
        if (imagemMetaAdsData) {
          // Se tem imagem_meta_ads, criar uma linha para cada imagem
          const imagensArray = Array.isArray(imagemMetaAdsData) ? imagemMetaAdsData : [imagemMetaAdsData];
          
          // Log detalhado para debug - mostrar TODOS os cursos com imagem_meta_ads
          console.log(`🔍 ${baseId} (${title}) - ${imagensArray.length} imagem(ns) encontrada(s)`);
          
          imagensArray.forEach((imagemItem, imgIndex) => {
            const imagemAttrs = imagemItem?.attributes;
            if (!imagemAttrs?.url) {
              console.warn(`⚠️ Curso-pagina ${baseId} (${title}) - Imagem ${imgIndex + 1}/${imagensArray.length} não tem URL válida. Pulando...`);
              return;
            }
            
            const imageUrl = imagemAttrs.url;
            const image_link = imageUrl.startsWith("http") 
              ? imageUrl 
              : `https://cms-site.grupointegrado.br${imageUrl}`;
            
            // Imagem adicional: usa formato large/medium da mesma imagem
            const additionalUrl = imagemAttrs.formats?.large?.url || 
                                 imagemAttrs.formats?.medium?.url || "";
            const additional_image_link = additionalUrl
              ? (additionalUrl.startsWith("http") ? additionalUrl : `https://cms-site.grupointegrado.br${additionalUrl}`)
              : "";
            
            // ID único para cada imagem (adiciona índice da imagem)
            const id = imagensArray.length > 1 
              ? `${baseId}_img${imgIndex + 1}` 
              : baseId;
            
            const csvRow = [
              escapeCsvValue(id),
              escapeCsvValue(title),
              escapeCsvValue(description),
              availability,
              condition,
              price,
              escapeCsvValue(link),
              escapeCsvValue(image_link),
              escapeCsvValue(brand),
              escapeCsvValue(category),
              escapeCsvValue(additional_image_link),
              escapeCsvValue(latitude),
              escapeCsvValue(longitude),
              escapeCsvValue(radiusFormatted.replace(' km', '')),
              "km",
              escapeCsvValue(postalCodes),
            ].join(",");

            csvRows.push(csvRow);
            console.log(`✅ Curso-pagina adicionado: ${id} - ${title} - imagem_meta_ads [${imgIndex + 1}/${imagensArray.length}] - Imagem: OK`);
          });
        } else if (bannerData?.url) {
          // Se não tem imagem_meta_ads, usa imagem_banner (fallback)
          const imageUrl = bannerData.url;
          const image_link = imageUrl.startsWith("http") 
            ? imageUrl 
            : `https://cms-site.grupointegrado.br${imageUrl}`;
          
          const additionalUrl = bannerData.formats?.large?.url || 
                               bannerData.formats?.medium?.url || "";
          const additional_image_link = additionalUrl
            ? (additionalUrl.startsWith("http") ? additionalUrl : `https://cms-site.grupointegrado.br${additionalUrl}`)
            : "";

          const csvRow = [
            escapeCsvValue(baseId),
            escapeCsvValue(title),
            escapeCsvValue(description),
            availability,
            condition,
            price,
            escapeCsvValue(link),
            escapeCsvValue(image_link),
            escapeCsvValue(brand),
            escapeCsvValue(category),
            escapeCsvValue(additional_image_link),
            escapeCsvValue(latitude),
            escapeCsvValue(longitude),
            escapeCsvValue(radiusFormatted.replace(' km', '')),
            "km",
            escapeCsvValue(postalCodes),
          ].join(",");

          csvRows.push(csvRow);
          console.log(`✅ Curso-pagina adicionado: ${baseId} - ${title} - imagem_banner - Imagem: OK`);
        } else {
          console.warn(`⚠️ Curso-pagina ${baseId} (${title}) não tem imagem válida. Pulando...`);
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao processar curso-pagina ${cursoPagina.id || index}:`, error.message);
      }
    });

    const totalItens = csvRows.length - 1; // -1 porque a primeira linha é o header
    fs.writeFileSync("meta_feed.csv", csvRows.join("\n"), "utf8");
    console.log("📦 Arquivo meta_feed.csv gerado com sucesso!");
    
    // Contar quantas imagens de imagem_meta_ads foram adicionadas
    let totalImagensMetaAds = 0;
    let totalCursosComMetaAds = 0;
    const detalhesImagens = [];
    
    cursosPaginaComImagem.forEach(cp => {
      const attrs = cp.attributes;
      const imagemMetaAdsData = attrs.imagem_meta_ads?.data;
      if (imagemMetaAdsData) {
        const imagensArray = Array.isArray(imagemMetaAdsData) ? imagemMetaAdsData : [imagemMetaAdsData];
        totalImagensMetaAds += imagensArray.length;
        totalCursosComMetaAds++;
        detalhesImagens.push({
          id: cp.id,
          titulo: attrs.titulo,
          quantidade: imagensArray.length
        });
      }
    });
    
    const totalBanners = banners.length;
    const totalCursoPaginas = totalItens - totalBanners;
    
    console.log(`📊 Total de ${totalItens} itens exportados:`);
    console.log(`   - ${totalBanners} banners`);
    console.log(`   - ${totalCursoPaginas} linhas de curso-páginas`);
    console.log(`📸 ${totalCursosComMetaAds} curso-páginas com imagem_meta_ads (${totalImagensMetaAds} imagens no total)`);
    
    // Mostrar detalhes de cada curso
    console.log(`\n📋 Detalhamento por curso:`);
    detalhesImagens.forEach((item, index) => {
      console.log(`   ${index + 1}. ID ${item.id} - ${item.titulo}: ${item.quantidade} imagem(ns)`);
    });
    
    // Aviso se faltarem imagens
    const esperado = 36; // Total esperado de imagens
    if (totalImagensMetaAds < esperado) {
      console.log(`\n⚠️ ATENÇÃO: Esperado ${esperado} imagens, mas apenas ${totalImagensMetaAds} foram encontradas pela API!`);
      console.log(`   Faltam ${esperado - totalImagensMetaAds} imagens que não estão sendo retornadas pelo Strapi.`);
      console.log(`   \n   O código está processando TODAS as imagens que a API retorna.`);
      console.log(`   O problema está no Strapi - verifique se todas as imagens foram:`);
      console.log(`   1. ✅ Adicionadas no campo "imagem_meta_ads" (não em "imagem_banner")`);
      console.log(`   2. ✅ Salvas (botão "Save" no Strapi)`);
      console.log(`   3. ✅ Publicadas (não em draft - botão "Publish")`);
      console.log(`   4. ✅ Aguarde alguns segundos após salvar/publicar`);
    } else if (totalImagensMetaAds === esperado) {
      console.log(`\n✅ Todas as ${esperado} imagens foram encontradas e processadas!`);
    }
    console.log("💡 Esta versão usa coordenadas GPS (formato Facebook: lat,lng)");
    console.log("🔗 URL fixa: https://raw.githubusercontent.com/Badizan/meta-feed-grupo-integrado/main/meta_feed.csv");
  } catch (error) {
    console.error("❌ Erro geral:", error.message);
  }
}

gerarFeedMeta();
