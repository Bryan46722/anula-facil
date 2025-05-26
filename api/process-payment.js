export default async function handler(req, res) {
    // Headers CORS
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
        console.log('🟢 API funcionando!');
        console.log('📨 Dados recebidos:', req.body);

        const { payment_method_id, payer, transaction_amount } = req.body;

        // TESTE 1: Retornar dados recebidos
        if (!payment_method_id) {
            return res.status(400).json({ 
                error: 'payment_method_id obrigatório',
                received: req.body 
            });
        }

        // TESTE 2: Simular PIX sem Mercado Pago (para testar se a API funciona)
        if (payment_method_id === 'pix') {
            console.log('🧪 Simulando PIX para teste...');
            
            // QR Code de teste que funciona
            const testQrCode = '00020101021226580014br.gov.bcb.pix2536pix.example.com/qr/v2/9d36b84f-c70f-620454035303986520040000530398654040.015802BR5913ANULA FACIL6014BRASILIA62070503***63041234';
            
            return res.status(200).json({
                id: 'test_pix_' + Date.now(),
                status: 'pending',
                payment_method_id: 'pix',
                qr_code: testQrCode,
                qr_code_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAAeFBMVEX///8AAAD7+/sEBAQICAj39/fz8/Pw8PDt7e3q6uro6Ojl5eXi4uLf39/c3Nz29vbT09PQ0NDNzc3Kysnb29vGxsYgICC+vr48PDw1NTUtLS0pKSkcHBwUFBQQEBA=',
                test_mode: true,
                message: 'API funcionando! Agora vamos testar o Mercado Pago real.'
            });
        }

        // TESTE 3: Outros métodos
        return res.status(200).json({
            id: 'test_' + Date.now(),
            status: 'approved',
            payment_method_id: payment_method_id,
            test_mode: true,
            message: 'Método simulado funcionando!'
        });

    } catch (error) {
        console.error('💥 ERRO:', error);
        
        return res.status(500).json({
            error: 'Erro no servidor',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}