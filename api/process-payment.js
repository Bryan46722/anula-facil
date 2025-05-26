export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        console.log('✅ API funcionando! Dados:', req.body);
        
        // Simular resposta de sucesso
        const response = {
            id: 'simulado_' + Date.now(),
            status: 'approved',
            status_detail: 'accredited',
            payment_method_id: req.body.payment_method_id || 'visa'
        };

        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ 
            error: 'Erro na API',
            message: error.message 
        });
    }
}