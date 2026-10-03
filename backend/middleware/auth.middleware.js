const jwt= require("jsonwebtoken");
const User = require("../models/User");
const redisClient = require("../utils/redisClient")

// protects routes

const protect = async (req,res,next)=>{
    try{
        let token;

        if(req.headers.authorization?.startsWith("Bearer")){
            token = req.headers.authorization.split(" ")[1];
        }

        if(!token){
            return res.status(401).json({
                success : false,
                message : "Not authorized - no token provided",
            });
        }

        // check blacklisted token before verifying
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                message: "Session expired - please log in again",
            });
        }

        // verify signature
        const decoded= jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if(!user){
            return res.status(401).json({
                success : false,
                message : "User no longer exists",
            });
        }

    if (user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: "Account has been deleted",
      });
    }
 
    if (user.accountStatus === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account is suspended",
      });
    }

    req.user = user;
    req.token = token;
    next()
    }
    catch(error){
        next(error) // forwards to error.middleware.js
    }
}

module.exports = {protect};