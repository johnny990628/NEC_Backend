const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const axios = require('axios')
const { getAccessTokenForRegistration } = require('../auth')
const { USER } = require('../../models/user')

const getAllUsers = async (accessToken) => {
    const { data: users } = await axios({
        method: 'get',
        url: process.env.KEYCLOAK_AUTH_USERS_URL,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    return users
}
const getRolesById = async (accessToken, userId) => {
    const { data: roles } = await axios({
        method: 'get',
        url: `${process.env.KEYCLOAK_AUTH_USERS_URL}/${userId}/role-mappings/realm`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    return roles
}

const addRolesById = async (accessToken, userId, updateRole) => {
    const { data: roles } = await axios({
        method: 'post',
        url: `${process.env.KEYCLOAK_AUTH_USERS_URL}/${userId}/role-mappings/realm`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        data: [updateRole],
    })
    return roles
}

const deleteRolesById = async (accessToken, userId, removeRole) => {
    const { data: roles } = await axios({
        method: 'delete',
        url: `${process.env.KEYCLOAK_AUTH_USERS_URL}/${userId}/role-mappings/realm`,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        data: [removeRole],
    })
    return roles
}

router.route('/').get(async (req, res) => {
    /* 	
            #swagger.tags = ['Users']
            #swagger.description = '取得使用者' 
        */
    try {
        const { limit, offset, search, sort, desc } = req.query
        // if (!limit || !offset) return res.status(400).json({ message: 'Need a limit and offset' })
        const accessToken = req.accessToken

        const users = await getAllUsers(accessToken)
        const results = await Promise.all(
            users.map(async (user) => {
                const roles = await getRolesById(accessToken, user.id)
                return { ...user, roles }
            })
        )

        return res.status(200).json({ count: results.length, results: results })
    } catch (e) {
        console.log(e)
        return res.status(500).json({ message: e.message })
    }
})

router
    .route('/:_id')
    .get(async (req, res) => {
        /* 	
            #swagger.tags = ['Users']
            #swagger.description = '取得一位使用者' 
        */
        try {
            const { _id } = req.params
            const user = await USER.findOne({ _id }).select({ password: 0 })
            if (!user) return res.status(404).json({ message: '找不到使用者資料' })
            return res.status(200).json(user)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })
    .patch(async (req, res) => {
        /* 	
            #swagger.tags = ['Users']
            #swagger.description = '更新一位使用者' 
        */
        try {
            const { _id } = req.params
            const { currentRole, updateRole } = req.body
            const accessToken = req.accessToken
            const roles = await addRolesById(accessToken, _id, updateRole)
            if (currentRole) await deleteRolesById(accessToken, _id, currentRole)
            return res.status(200).json(roles)
        } catch (e) {
            console.log(e)
            return res.status(500).json({ message: e.message })
        }
    })
    .delete(async (req, res) => {
        /* 	
            #swagger.tags = ['Users']
            #swagger.description = '刪除一位使用者' 
        */
        try {
            const { _id } = req.params
            const user = await USER.findOneAndDelete({ _id }).select({ password: 0 })
            if (!user) return res.status(404).json({ message: '找不到使用者資料' })

            return res.status(200).json(user)
        } catch (e) {
            return res.status(500).json({ message: e.message })
        }
    })

module.exports = router
