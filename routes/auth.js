require('dotenv').config()
const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const axios = require('axios')
const bcrypt = require('bcrypt')
const { USER } = require('../models/user')

const verifyToken = (req, res, next) => {
    const accessToken =
        req.cookies.accessToken || (req.headers['authorization'] ? req.headers['authorization'].split(' ').pop() : null)

    if (accessToken) {
        jwt.verify(accessToken, process.env.JWT_SECRECT_KEY, (err, token) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid token' })
            } else {
                req.token = token
                return next()
            }
        })
    } else {
        return res.status(403).json({ message: 'Need a token' })
    }
}

const verifyTokenGetUser = (accessToken) => {
    const secretKey = process.env.JWT_SECRECT_KEY
    const decoded = jwt.verify(accessToken, secretKey)
    const userId = decoded.id
    const username = decoded.username
    return { userId, username }
}

const getAccessTokenForRegistration = () => {
    return axios({
        method: 'post',
        url: process.env.KEYCLOAK_AUTH_TOKEN_URL,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: {
            grant_type: 'client_credentials',
            client_id: process.env.KEYCLOAK_AUTH_CLIENT_ID,
            client_secret: process.env.KEYCLOAK_AUTH_CLIENT_SECRET,
        },
    })
}

const registerUser = ({ userData, accessToken }) => {
    return axios({
        method: 'post',
        url: process.env.KEYCLOAK_AUTH_REGISTRY_URL,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        data: userData,
    })
}
// router.route('/login').post(async (req, res) => {
//     /*
//         #swagger.tags = ['Auth']
//         #swagger.description = '登入'
//     */
//     try {
//         const { username, password } = req.body
//         const user = await USER.findOne({ username })
//         if (!user) return res.status(401).json({ message: '查無使用者' })

//         if (await bcrypt.compare(password, user.password)) {
//             if (user.role === 0) return res.status(401).json({ message: '使用者權限不足，等待管理員審核' })
//             const accessToken = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRECT_KEY, {
//                 expiresIn: 86400000,
//             })
//             user.password = null
//             return res
//                 .cookie('accessToken', accessToken, {
//                     maxAge: 86400000,
//                     // maxAge: 6000,
//                     secure: false, //set true if using https
//                     httpOnly: true, //can't access from javascript
//                     sameSite: true,
//                 })
//                 .status(200)
//                 .json({ message: 'login successful', user, token: accessToken })
//         } else {
//             return res.status(401).json({ message: '密碼錯誤' })
//         }
//     } catch (error) {
//         return res.status(500).json({ error })
//     }
// })

// router.route('/logout').post((req, res, next) => {
//     /*
//         #swagger.tags = ['Auth']
//         #swagger.description = '登出'
//     */
//     return res.clearCookie('accessToken').status(200).json({ message: 'logout successful' })
// })

router.route('/register').post(async (req, res) => {
    /* 	
        #swagger.tags = ['Auth']
        #swagger.description = '註冊' 
    */
    try {
        const {
            data: { access_token },
        } = await getAccessTokenForRegistration()
        if (!access_token) return res.status(502).json({ message: 'Cant get access token from authorization server' })

        const { email, username, name, password } = req.body
        if (!email || !username || !password || !name) return res.status(400).json({ message: 'Invalid user data' })
        const userData = {
            email,
            username,
            firstName: name,
            enabled: true,
            credentials: [
                {
                    type: 'password',
                    value: password,
                },
            ],
        }

        const { status } = await registerUser({ accessToken: access_token, userData })
        if (status !== 201) return res.status(502).json({ message: 'Bad request from authorization server' })

        return res.status(200).json({ message: 'Registration successfully' })
    } catch (e) {
        if (e.response) return res.status(502).json({ message: e.response.data.errorMessage })
        else return res.status(500).json({ message: e.message })
    }
})

router.route('/verify').post(async (req, res) => {
    /* 	
        #swagger.tags = ['Auth']
        #swagger.description = '驗證' 
    */
    try {
        const accessToken =
            req.cookies.accessToken ||
            (req.headers['authorization'] ? req.headers['authorization'].split(' ').pop() : null)

        if (accessToken) {
            jwt.verify(accessToken, process.env.JWT_SECRECT_KEY, async (err, token) => {
                if (err) {
                    return res.status(403).json({ message: 'Invalid token' })
                } else {
                    const user = await USER.findOne({ _id: token.id }).select({ password: 0 })
                    return res.status(200).json({ message: 'Valid token', user, token: accessToken })
                }
            })
        } else {
            return res.status(403).json({ message: 'Need a token' })
        }
    } catch (error) {
        return res.status(500).json({ error })
    }
})

module.exports = { router, verifyToken, verifyTokenGetUser }
