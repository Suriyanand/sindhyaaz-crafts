const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Mock Razorpay instance if keys aren't provided
let razorpay = null;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
    });
}

router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;
        
        if (!amount) {
            return res.status(400).json({ success: false, error: 'Amount is required' });
        }

        if (razorpay) {
            const options = {
                amount: Math.round(amount * 100), // amount in smallest currency unit
                currency,
                receipt: receipt || `receipt_${Date.now()}`
            };
            const order = await razorpay.orders.create(options);
            return res.json({ success: true, data: order });
        } else {
            // Return mock order for testing
            const mockOrder = {
                id: `order_mock_${Date.now()}`,
                entity: 'order',
                amount: Math.round(amount * 100),
                currency,
                receipt: receipt || `receipt_${Date.now()}`,
                status: 'created',
                created_at: Math.floor(Date.now() / 1000)
            };
            return res.json({ success: true, data: mockOrder });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});

router.post('/verify', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!RAZORPAY_KEY_SECRET) {
            // Mock verification for testing
            return res.json({ success: true, data: { verified: true, mock: true } });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');
            
        if (expectedSignature === razorpay_signature) {
            res.json({ success: true, data: { verified: true } });
        } else {
            res.status(400).json({ success: false, error: 'Invalid signature' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
