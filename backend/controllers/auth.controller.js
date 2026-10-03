const User = require("../models/User")
const generateToken = require("../utils/generateToken")
const jwt = require("jsonwebtoken")
const redisClient = require("../utils/redisClient")


// Post req-> api/auth/signup

const signup = async (req, res, next) => {
    try {
        const { name, email, phoneNumber, password } = req.body;

        if (!name || !email || !phoneNumber || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, phone number, and password are all required",
            });
        }

        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { phoneNumber }]
        })

        if (existingUser) {
            const field = existingUser.email === email.toLowerCase() ? "email" : "phone number";
            return res.status(409).json({
                success: false,
                message: `An account with this ${field} already exists`,
            });
        }

        const user = await User.create({
            name,
            email,
            phoneNumber,
            password,
            authProvider: "local",
        });

        const token = generateToken(user._id);

        // user.toJSON() automatically strips password via the transform function we defined in the schema

        res.status(201).json({
            success: true,
            token,
            user
        });
    }
    catch (error) {
        next(error);
    }
}



// Post /api/auth/login

const login = async (req, res, next) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Identifier (email or phone) and password are required",
            });
        }

        const user = await User.findOne({
            $or: [{ email: identifier.toLowerCase() },
            { phoneNumber: identifier },
            ],
        }).select("+password")

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        if (user.authProvider === "google") {
            return res.status(400).json({
                success: false,
                message: "This account uses Google sign-in. Please log in with Google."
            })
        }


        const isPasswordCorrect = await user.comparePassword(password);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        if (user.isDeleted) {
            return res.status(401).json({
                success: false,
                message: "This account has been deleted",
            });
        }

        if (user.accountStatus === "suspended") {
            return res.status(403).json({
                success: false,
                message: "This account is suspended",
            });
        }

        user.lastLoginAt = new Date();

        user.save({ validateBeforeSave: false });

        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            token,
            user,
        });
    } catch (error) {
        next(error)
    }
}


// Get /api/auth/me
// returns the currently logged-in user's data

const getMe = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            user: req.user,
        })
    }
    catch (error) {
        next(error)
    }
}

// Post /api/auth/logout
const logout = async (req, res, next) => {
    try {
        const token = req.token;

        // Decode (not verify — protect already verified it) just to read the expiry claim
        const decoded = jwt.decode(token);
        const expiresInSeconds = decoded.exp - Math.floor(Date.now() / 1000);

        if (expiresInSeconds > 0) {
            await redisClient.set(`blacklist:${token}`, "true", "EX", expiresInSeconds);
        }

        res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });
    } catch (error) {
        next(error);
    }
};


module.exports = { signup, login, getMe, logout};