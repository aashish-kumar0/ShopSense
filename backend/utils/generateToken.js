const jwt = require("jsonwebtoken")

// creates a signed jwt containing the users id

const generateToken = (userId)=>{
    return jwt.sign(
        {userId},
        process.env.JWT_SECRET,
        {expiresIn : process.env.JWT_EXPIRES_IN ||  "7d"}
    )
};

module.exports = generateToken;