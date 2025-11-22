import { GoogleGenAI } from "@google/genai";
import { Order, Product, Customer } from "../types";

export const generateBusinessReport = async (
  orders: Order[],
  products: Product[],
  customers: Customer[]
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prepare data summary for the prompt
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const lowStockProducts = products.filter(p => p.stock < 5).map(p => p.name);
    
    // Serialize a simplified version of recent orders
    const recentOrders = orders.slice(-20).map(o => ({
      date: o.date,
      total: o.total,
      items: o.items.map(i => i.productName)
    }));

    const prompt = `
      Atue como um consultor de negócios sênior. Analise os seguintes dados de vendas de uma pequena empresa e forneça um relatório conciso e acionável em Português.
      
      Dados Gerais:
      - Receita Total: R$ ${totalRevenue.toFixed(2)}
      - Total de Pedidos: ${totalOrders}
      - Total de Clientes: ${customers.length}
      - Produtos com estoque baixo (<5): ${lowStockProducts.join(', ') || 'Nenhum'}
      
      Amostra de Pedidos Recentes (JSON):
      ${JSON.stringify(recentOrders)}
      
      Por favor, forneça:
      1. Uma análise de tendência breve.
      2. Sugestões para melhorar as vendas.
      3. Alertas sobre estoque ou gestão de clientes.
      
      Use formatação Markdown clara.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Error generating AI report:", error);
    return "Erro ao conectar com a IA. Verifique sua chave de API ou tente novamente mais tarde.";
  }
};