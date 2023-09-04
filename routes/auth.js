require('dotenv').config()
const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const axios = require('axios')
const bcrypt = require('bcrypt')
const keycloak = require('../utils/Keycloak')
const { USER } = require('../models/user')

const verifyToken = async (req, res, next) => {
    try {
        const accessToken =
            req.cookies.accessToken ||
            (req.headers['authorization'] ? req.headers['authorization'].split(' ').pop() : null)

        if (accessToken) {
            const { data } = await axios({
                url: process.env.KEYCLOAK_AUTH_BASE_URL + process.env.KEYCLOAK_AUTH_VERIFY,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            })

            if (data) {
                req.token = accessToken
                return next()
            } else {
                return res.status(403).json({ message: 'Invalid token' })
            }
        } else {
            return res.status(403).json({ message: 'Need a token' })
        }
    } catch (e) {
        if (e.response) return res.status(403).json({ message: e.response.data.errorMessage })
        else return res.status(500).json({ message: e.message })
    }
}

const verifyTokenGetUser = (accessToken) => {
    const secretKey = process.env.JWT_SECRECT_KEY
    const decoded = jwt.verify(accessToken, secretKey)
    const userId = decoded.id
    const username = decoded.username
    return { userId, username }
}

const getAccessTokenForRegistration = async (req, res, next) => {
    try {
        const {
            data: { access_token },
        } = await axios({
            method: 'post',
            url: process.env.KEYCLOAK_AUTH_BASE_URL + process.env.KEYCLOAK_AUTH_TOKEN,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: {
                grant_type: 'client_credentials',
                client_id: process.env.KEYCLOAK_AUTH_CLIENT_ID,
                client_secret: process.env.KEYCLOAK_AUTH_CLIENT_SECRET,
            },
        })

        if (access_token) {
            req.accessToken = access_token
            return next()
        } else {
            return res.status(500).json({ message: 'Cant get access token' })
        }
    } catch (e) {
        return res.status(500).json({ message: e.message })
    }
}

const registerUser = ({ userData, accessToken }) => {
    return axios({
        method: 'post',
        url: process.env.KEYCLOAK_AUTH_BASE_URL + process.env.KEYCLOAK_AUTH_REGISTRY,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        data: userData,
    })
}

router.route('/register').post(async (req, res) => {
    /* 	
        #swagger.tags = ['Auth']
        #swagger.description = '註冊' 
    */
    try {
        const {
            data: { access_token: accessToken },
        } = await getAccessTokenForRegistration()

        if (!accessToken) return res.status(502).json({ message: 'Cant get access token from authorization server' })

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

        const { status } = await registerUser({ accessToken, userData })
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

module.exports = { router, verifyToken, verifyTokenGetUser, getAccessTokenForRegistration }
