import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new Payment(client);

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
        // Verificar assinatura do webhook (segurança)
        const signature = req.headers['x-signature'];
        const requestId = req.headers['x-request-id'];
        
        if (process.env.MP_WEBHOOK_SECRET && signature) {
            const elements = signature.split(',');
            
            let ts;
            let hash;
            
            elements.forEach(element => {
                const keyValue = element.split('=');
                if (keyValue[0] && keyValue[0].trim() === 'ts') {
                    ts = keyValue[1].trim();
                }
                if (keyValue[0] && keyValue[0].trim() === 'v1') {
                    hash = keyValue[1].trim();
                }
            });
            
            const secret = process.env.MP_WEBHOOK_SECRET;
            const manifest = `id:${req.body.data?.id};request-id:${requestId};ts:${ts};`;
            
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(manifest);
            const sha = hmac.digest('hex');
            
            if (sha !== hash) {
                console.log('❌ Assinatura do webhook inválida');
                return res.status(400).json({ error: 'Assinatura inválida' });
            }
        }

        console.log('🔔 Webhook recebido:', JSON.stringify(req.body, null, 2));
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));

        const { type, data, action } = req.body;

        if (type === 'payment' || action === 'payment.updated') {
            const paymentId = data.id;
            
            console.log(`🔍 Consultando pagamento ID: ${paymentId}`);
            
            const paymentInfo = await payment.get({ id: paymentId });
            
            console.log('📊 Status do pagamento:', {
                id: paymentInfo.id,
                status: paymentInfo.status,
                status_detail: paymentInfo.status_detail,
                external_reference: paymentInfo.external_reference,
                transaction_amount: paymentInfo.transaction_amount,
                payment_method_id: paymentInfo.payment_method_id,
                payer_email: paymentInfo.payer.email
            });

            switch (paymentInfo.status) {
                case 'approved':
                    console.log('✅ Pagamento aprovado! Ativando serviços...');
                    await processApprovedPayment(paymentInfo);
                    break;
                    
                case 'pending':
                    console.log('⏳ Pagamento pendente...');
                    await processPendingPayment(paymentInfo);
                    break;
                    
                case 'in_process':
                    console.log('🔄 Pagamento em processamento...');
                    break;
                    
                case 'rejected':
                    console.log('❌ Pagamento rejeitado...');
                    await processRejectedPayment(paymentInfo);
                    break;
                    
                case 'cancelled':
                    console.log('🚫 Pagamento cancelado...');
                    break;
                    
                default:
                    console.log(`❓ Status desconhecido: ${paymentInfo.status}`);
            }
        } else {
            console.log(`ℹ️ Tipo de notificação não processada: ${type || action}`);
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('💥 Erro no webhook:', error);
        res.status(200).json({ 
            error: 'Erro interno', 
            received: true 
        });
    }
}

async function processApprovedPayment(paymentInfo) {
    try {
        console.log('🎉 Processando pagamento aprovado...');
        
        const customerEmail = paymentInfo.payer.email;
        const planType = paymentInfo.metadata?.plan_type;
        const amount = paymentInfo.transaction_amount;
        const externalRef = paymentInfo.external_reference;
        
        console.log(`📧 Cliente: ${customerEmail}`);
        console.log(`📦 Plano: ${planType}`);
        console.log(`💰 Valor: R$ ${amount}`);
        console.log(`🔗 Referência: ${externalRef}`);
        
        // AQUI VOCÊ PODE IMPLEMENTAR:
        // 1. Enviar email de confirmação
        // 2. Ativar acesso ao sistema
        // 3. Salvar no banco de dados
        // 4. Enviar WhatsApp
        
        const activationData = {
            payment_id: paymentInfo.id,
            customer_email: customerEmail,
            plan_type: planType,
            amount: amount,
            status: 'approved',
            activated_at: new Date().toISOString(),
            external_reference: externalRef
        };
        
        console.log('📝 Dados para ativação:', JSON.stringify(activationData, null, 2));
        
        // TODO: Implementar suas integrações aqui
        // await sendConfirmationEmail(activationData);
        // await activateUserAccess(activationData);
        // await saveToDatabase(activationData);
        
    } catch (error) {
        console.error('❌ Erro ao processar pagamento aprovado:', error);
    }
}

async function processPendingPayment(paymentInfo) {
    try {
        console.log('⏳ Processando pagamento pendente...');
        
        const customerEmail = paymentInfo.payer.email;
        const paymentMethod = paymentInfo.payment_method_id;
        
        if (paymentMethod === 'pix') {
            console.log('💰 PIX aguardando pagamento...');
        } else if (paymentMethod === 'bolbradesco') {
            console.log('🧾 Boleto aguardando pagamento...');
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar pagamento pendente:', error);
    }
}

async function processRejectedPayment(paymentInfo) {
    try {
        console.log('❌ Processando pagamento rejeitado...');
        
        const customerEmail = paymentInfo.payer.email;
        const statusDetail = paymentInfo.status_detail;
        
        console.log(`📧 Cliente: ${customerEmail}`);
        console.log(`💳 Motivo: ${statusDetail}`);
        
    } catch (error) {
        console.error('❌ Erro ao processar pagamento rejeitado:', error);
    }
}