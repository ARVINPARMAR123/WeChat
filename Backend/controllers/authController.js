import { UserModel as User } from "../prisma/prismaModels.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const PROFILE_LIMITS = {
    displayName: 80,
    about: 280,
    statusLine: 140,
    accent: 20,
    city: 80,
    phone: 40,
    profilePicture: 1_500_000,
};

const ALLOWED_ACCENTS = new Set(["lagoon", "coral", "sunrise", "moss"]);

const sanitizeProfilePayload = (payload = {}) => {
    const nextData = {};

    const stringFields = ["displayName", "about", "statusLine", "accent", "city", "phone", "profilePicture"];

    for (const field of stringFields) {
        if (!Object.prototype.hasOwnProperty.call(payload, field)) {
            continue;
        }

        const rawValue = payload[field];

        if (typeof rawValue !== "string") {
            return { error: `${field} must be a string.` };
        }

        const value = rawValue.trim();

        if (value.length > PROFILE_LIMITS[field]) {
            return { error: `${field} is too long.` };
        }

        if (field === "accent" && value && !ALLOWED_ACCENTS.has(value)) {
            return { error: "Invalid accent value." };
        }

        if (
            field === "profilePicture" &&
            value &&
            !value.startsWith("data:image/") &&
            !value.startsWith("http://") &&
            !value.startsWith("https://")
        ) {
            return { error: "profilePicture must be a valid image URL or data URL." };
        }

        nextData[field] = value;
    }

    return { data: nextData };
};

const toPublicUser = (user) => {
    if (!user) {
        return null;
    }

    const { password, ...publicUser } = user;
    return publicUser;
};

export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        await User.create({
            username,
            email,
            password: hashedPassword,
        });
        res.status(201).json({ message: "User registered successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Generate JWT token
        const token = jwt.sign({ 
            userId: existingUser.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: "1h" });
        res.status(200).json({ token });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const logout = async (req, res) => {
    try {
        // Invalidate the token (implementation depends on how you manage tokens, e.g., using a blacklist)
        res.status(200).json({ message: "User logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(toPublicUser(user));
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const getUsers = async (req, res) => {
    try {
        const search = typeof req.query.search === "string"
            ? req.query.search.trim().toLowerCase()
            : "";

        const users = await User.findMany();

        const filteredUsers = users
            .filter((user) => user.id !== req.user.userId)
            .filter((user) => {
                if (!search) {
                    return true;
                }

                return [user.username, user.email]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(search));
            })
            .map(toPublicUser);

        res.status(200).json(filteredUsers);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const updateCurrentUser = async (req, res) => {
    try {
        const { data, error } = sanitizeProfilePayload(req.body);

        if (error) {
            return res.status(400).json({ message: error });
        }

        if (!data || !Object.keys(data).length) {
            return res.status(400).json({ message: "No profile fields provided" });
        }

        const updatedUser = await User.updateProfile(req.user.userId, data);

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            message: "Profile updated successfully",
            user: toPublicUser(updatedUser),
        });
    } catch (error) {
        return res.status(500).json({ message: "Server error" });
    }
};