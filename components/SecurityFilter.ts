export class SecurityFilter {
  /**
   * Filtra mensajes para remover información sensible
   */
  static sanitizeMessage(message: string): string {
    const sensitivePatterns = [
      // Datos personales
      /\b\d{4,}\b/g,                    // Números largos (IDs, salarios)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
      /\b\d{3}-\d{3}-\d{4}\b/g,         // Teléfonos
      
      // Palabras sensibles
      /\b(salario|ganancia|dinero|pago|sueldo|ingreso|meta|objetivo)\b/gi,
      /\b(otra modelo|compañera|colega|otra chica|otra persona)\b/gi,
      /\b(chaturbate|onlyfans|mfc|stripchat|superfoon|aw)\b/gi,
      /\b(urgente|problema|error|bug|no funciona)\b/gi,
      
      // Nombres propios (detecta patrones)
      /\b[A-Z][a-z]{2,}\s[A-Z][a-z]{2,}\b/g, // Nombres completos
    ];
    
    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[FILTRADO]');
    });
    
    return sanitized;
  }
  
  /**
   * Crea un contexto seguro sin datos identificables
   */
  static createSafeContext(userData: any) {
    return {
      user_type: "modelo",
      has_portfolio: userData.portfolio?.length > 0 || false,
      platform_count: userData.portfolio?.length || 0,
      platform_types: userData.portfolio?.map((p: any) => p.currency) || [],
      has_calculator: userData.hasCalculator || false,
      // CERO datos identificables
    };
  }
  
  /**
   * Genera el prompt ultra-seguro
   */
  static getUltraSafePrompt(safeContext: any): string {
    return `
Eres un asistente genérico para modelos de webcam.
NO tienes acceso a datos específicos del usuario.
NO conoces nombres, plataformas específicas, o información personal.

CONTEXTO SEGURO:
- Tipo de usuario: ${safeContext.user_type}
- Tiene portafolio: ${safeContext.has_portfolio}
- Cantidad de plataformas: ${safeContext.platform_count}
- Tipos de moneda: ${safeContext.platform_types.join(', ') || 'N/A'}

RESPUESTAS PERMITIDAS:
- Consejos generales de engagement
- Tips de optimización genéricos
- Ayuda con la calculadora (sin datos específicos)
- Soporte técnico básico

RESPUESTAS PROHIBIDAS:
- Mencionar plataformas específicas
- Dar consejos personalizados
- Hablar de ganancias o metas específicas
- Resolver problemas específicos del usuario

EJEMPLOS DE RESPUESTAS CORRECTAS:
- "Para mejorar el engagement, puedes probar a interactuar más con tu audiencia, hacer preguntas, y usar el chat activamente."
- "La calculadora te ayuda a ver tus ganancias estimadas. Puedes ingresar tus valores y ver cómo se calculan tus ganancias en tiempo real."
- "Para optimizar tus ganancias, asegúrate de tener un buen perfil, usar tags relevantes, y mantener la calidad de tu contenido."

SIEMPRE responde de forma genérica y segura.
`;
  }
}
