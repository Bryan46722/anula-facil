import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new Payment(client);

const planData = {
    individual: { 
        name: 'Recurso Individual', 
        price: 39.90,
        description: 'Análise jurídica especializada para 1 multa'
    },
    intermediario: { 
        name: 'Pacote Intermediário', 
        price: 99.90,
        description: 'Recursos para até 5 multas com economia de 50%'
    },
    premium: { 
        name: 'Pacote Premium', 
        price: 149.90,
        description: 'Recursos para até 10 multas com proteção completa'
    },
    executivo: { 
        name: 'Pacote Executivo', 
        price: 249.90,
        description: 'Recursos ilimitados para frotas e motoristas profissionais'
    }
};

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
        console.log('Processando pagamento...');
        console.log('Dados recebidos:', req.body);

        const { 
            payment_method_id, 
            token, 
            installments, 
            transaction_amount, 
            payer, 
            plan,
            description 
        } = req.body;

        if (!payer || !payer.email || !transaction_amount) {
            return res.status(400).json({ 
                error: 'Dados obrigatórios não fornecidos'
            });
        }

        const paymentData = {
            transaction_amount: parseFloat(transaction_amount),
            description: description || planData[plan]?.description || 'Recurso de Multa - Anula Fácil',
            payment_method_id: payment_method_id,
            payer: {
                email: payer.email,
                first_name: payer.first_name,
                last_name: payer.last_name,
                identification: {
                    type: payer.identification.type,
                    number: payer.identification.number
                }
            },
            metadata: {
                plan_type: plan,
                source: 'anula_facil_website'
            },
            notification_url: `${getBaseUrl(req)}/api/webhook`,
            external_reference: `anula_facil_${Date.now()}_${plan}`
        };

        if (payment_method_id === 'pix') {
            paymentData.date_of_expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        } else if (token) {
            paymentData.token = token;
            paymentData.installments = parseInt(installments) || 1;
        } else if (payment_method_id === 'bolbradesco') {
            paymentData.date_of_expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        }

        console.log('Enviando para Mercado Pago...');
        const paymentResponse = await payment.create({ body: paymentData });

        console.log('Resposta MP:', paymentResponse.status);

        const response = {
            id: paymentResponse.id,
            status: paymentResponse.status,
            status_detail: paymentResponse.status_detail,
            payment_method_id: paymentResponse.payment_method_id,
            external_reference: paymentResponse.external_reference
        };

        if (payment_method_id === 'pix' && paymentResponse.point_of_interaction) {
            response.qr_code = paymentResponse.point_of_interaction.transaction_data.qr_code;
            response.qr_code_base64 = paymentResponse.point_of_interaction.transaction_data.qr_code_base64;
        }

        if (payment_method_id === 'bolbradesco' && paymentResponse.transaction_details) {
            response.ticket_url = paymentResponse.transaction_details.external_resource_url;
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('Erro:', error);
        
        if (error.cause && error.cause.length > 0) {
            const cause = error.cause[0];
            return res.status(400).json({ 
                error: cause.description || 'Erro no pagamento',
                code: cause.code
            });
        }

        res.status(500).json({ 
            error: 'Erro interno do servidor'
        });
    }
}

function getBaseUrl(req) {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    return `${protocol}://${host}`;
}