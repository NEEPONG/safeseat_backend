const { supabase } = require('../../config/supabase.js');

const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Please provide both phone and password' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            phone,
            password
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({
            message: 'Login successful',
            user: data.user,
            session: data.session
        });
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { login };

