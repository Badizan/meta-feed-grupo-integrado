/**
 * Gera automaticamente um feed CSV compatível com o Meta Ads (Facebook/Instagram)
 * usando os cursos do Strapi (CMS do Grupo Integrado)
 * 
 * Campos incluídos: id, title, description, availability, condition, price,
 * link, image_link, brand, category, additional_image_link,
 * availability_circle_origin.latitude, availability_circle_origin.longitude,
 * availability_circle_radius, availability_circle_radius_unit, availability_postal_codes
 */

import fs from "fs";
import fetch from "node-fetch";

const STRAPI_URL = "https://cms-site.grupointegrado.br/api/cursos?populate=*";
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
  console.log("🔄 Buscando cursos do Strapi...");

  try {
    const response = await fetch(STRAPI_URL, {
      headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    });

    if (!response.ok) {
      console.error("❌ Erro ao acessar a API do Strapi:", response.status, response.statusText);
      return;
    }

    const json = await response.json();
    const cursos = json.data || [];

    // Filtrar apenas cursos que têm banner/imagem
    const cursosComBanner = cursos.filter(curso => curso.attributes?.banner?.data);

    console.log(`✅ ${cursos.length} cursos encontrados, ${cursosComBanner.length} com banner.`);

    // Formato oficial do Meta: coordenadas separadas por latitude/longitude
    const csvHeader =
      "id,title,description,availability,condition,price,link,image_link,brand,google_product_category,additional_image_link,availability_circle_origin.latitude,availability_circle_origin.longitude,availability_circle_radius,availability_circle_radius_unit,availability_postal_codes";
    const csvRows = [csvHeader];

    cursosComBanner.forEach((curso, index) => {
      try {
        const attrs = curso.attributes;
        const id = curso.id || `curso_${index}`;
        const title = attrs.name || "Curso Grupo Integrado";
        const modalidade = attrs.modalidade || "";
        const tipoCurso = attrs.tipo_curso || "Graduação";
        const description = `${title} - ${modalidade} - Grupo Integrado. Educação de qualidade e tradição.`;

        // Link do curso
        let link = attrs.url || "https://www.grupointegrado.br";
        if (!link.startsWith("http")) {
          link = `https://www.grupointegrado.br${link}`;
        }

        const availability = "in stock";
        const condition = "new";
        const price = "0.00 BRL";
        const brand = "Grupo Integrado";
        const category = determinarCategoria(title, modalidade);
        const coordenadas = determinarCoordenadas(title, link);
        const postalCodes = determinarCodigosPostais(title, link);

        // Imagens do banner
        const bannerData = attrs.banner?.data?.attributes;
        const image_link = bannerData?.url || "";
        
        // Imagem adicional (usar formato medium se disponível)
        const additional_image_link = bannerData?.formats?.large?.url || bannerData?.formats?.medium?.url || "";

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
           escapeCsvValue(latitude), // availability_circle_origin.latitude
           escapeCsvValue(longitude), // availability_circle_origin.longitude
           escapeCsvValue(radiusFormatted.replace(' km', '')), // Apenas o número do raio
           "km", // availability_circle_radius_unit
           escapeCsvValue(postalCodes),
         ].join(",");

        csvRows.push(csvRow);
      } catch (error) {
        console.warn(`⚠️ Erro ao processar curso ${curso.id || index}:`, error.message);
      }
    });

    fs.writeFileSync("meta_feed.csv", csvRows.join("\n"), "utf8");
    console.log("📦 Arquivo meta_feed.csv gerado com sucesso!");
    console.log(`📊 Total de ${cursosComBanner.length} cursos exportados`);
    console.log("💡 Esta versão usa coordenadas GPS (formato Facebook: lat,lng)");
    console.log("🔗 URL fixa: https://raw.githubusercontent.com/Badizan/meta-feed-grupo-integrado/main/meta_feed.csv");
  } catch (error) {
    console.error("❌ Erro geral:", error.message);
  }
}

gerarFeedMeta();
