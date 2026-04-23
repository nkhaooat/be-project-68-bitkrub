const jwt = require('jsonwebtoken');
const User = require('../models/User');

//Protect routes
exports.protect=async (req,res,next)=>{
    let token;

    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }

    //Make sure token exists
    if(!token) {
        return res.status(401).json({success:false, message:'Not authorize to access this route'});
    }

    try{
        //Verify token
        const decoded = jwt.verify(token,process.env.JWT_SECRET);

        console.log(decoded);

        req.user=await User.findById(decoded.id);

        next();
    }catch(err){
        console.log(err.stack);
        return res.status(401).json({success:false, message:'Not authorize to access this route'});
    }
};

//at the end of file
//Grant access to specific roles
// Merchant-only middleware — requires role=merchant AND merchantStatus=approved
exports.requireMerchant = () => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
        }
        if (req.user.role !== 'merchant') {
            return res.status(403).json({ success: false, message: 'Merchant access required' });
        }
        if (req.user.merchantStatus === 'pending') {
            return res.status(403).json({ success: false, message: 'Your merchant account is pending approval' });
        }
        if (req.user.merchantStatus === 'rejected') {
            return res.status(403).json({ success: false, message: 'Your merchant account has been rejected' });
        }
        if (req.user.merchantStatus !== 'approved') {
            return res.status(403).json({ success: false, message: 'Your merchant account is not approved' });
        }
        next();
    };
};

exports.authorize=(...roles)=>{
    return (req,res,next)=>{
        if(!roles.includes(req.user.role)){
            return res.status(403).json({success:false,
                message:`User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    }
}