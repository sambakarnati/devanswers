import { beforeEach, beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
// Import setup to initialize MongoDB
import '../setup.js';
import app from "../../src/app.js";
import Question from "../../src/models/Question.js";
import Tag from "../../src/models/Tag.js";
import dotenv from "dotenv";
dotenv.config();

let jwtToken;
let mockUser;

beforeAll(async () => {
    ({ mockUser, jwtToken } = await createUserAndLogin());
});

async function createUserAndLogin(overrides = {}) {
    const email = overrides.email || `bookmarkuser+${Date.now()}-${Math.random()}@example.com`;
    const password = "password123";

    const userRes = await request(app)
        .post("/api/auth/register")
        .send({
            name: overrides.name || "Bookmark User",
            email,
            password,
            isAdmin: overrides.isAdmin || false,
        });

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email, password });

    return {
        mockUser: userRes.body.data,
        jwtToken: loginRes.body.data.token,
    };
}

async function createTag(name = `tag-${Date.now()}-${Math.random()}`) {
    const tag = new Tag({ name });
    await tag.save();
    return tag;
}

async function createQuestion(questionData = {}) {
    const author = questionData.author || mockUser._id;
    const tag = await createTag();

    const defaultData = {
        title: "Bookmark Test Question",
        description: "Testing bookmarks",
        tags: [tag._id],
        author,
    };

    const question = new Question({ ...defaultData, ...questionData });
    await question.save();
    return question;
}

describe("Bookmark API", () => {
    let question;

    beforeEach(async () => {
        await Question.deleteMany({});
        await Tag.deleteMany({});

        question = await createQuestion();
    });

    it("POST /api/questions/:id/bookmark -> no token -> 401", async () => {
        const res = await request(app).post(`/api/questions/${question._id}/bookmark`);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it("POST /api/questions/:id/bookmark -> toggles bookmark on then off", async () => {
        const onRes = await request(app)
            .post(`/api/questions/${question._id}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);

        expect(onRes.status).toBe(200);
        expect(onRes.body.success).toBe(true);
        expect(onRes.body.message).toBe("Question bookmarked successfully");
        expect(onRes.body.data.bookmarked).toBe(true);

        const offRes = await request(app)
            .post(`/api/questions/${question._id}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);

        expect(offRes.status).toBe(200);
        expect(offRes.body.message).toBe("Question bookmark removed successfully");
        expect(offRes.body.data.bookmarked).toBe(false);
    });

    it("POST /api/questions/:id/bookmark -> nonexistent question -> 404", async () => {
        const fakeId = "507f1f77bcf86cd799439011";
        const res = await request(app)
            .post(`/api/questions/${fakeId}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it("GET /api/questions/bookmarked -> no token -> 401", async () => {
        const res = await request(app).get("/api/questions/bookmarked");

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it("GET /api/questions/bookmarked -> returns exactly the bookmarked questions, populated", async () => {
        const questionTwo = await createQuestion({ title: "Second Question" });

        await request(app)
            .post(`/api/questions/${question._id}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);
        await request(app)
            .post(`/api/questions/${questionTwo._id}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);

        const res = await request(app)
            .get("/api/questions/bookmarked")
            .set("Authorization", `Bearer ${jwtToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(2);

        const ids = res.body.data.map((q) => q._id);
        expect(ids).toContain(question._id.toString());
        expect(ids).toContain(questionTwo._id.toString());

        const bookmarked = res.body.data.find((q) => q._id === question._id.toString());
        expect(bookmarked.author).toHaveProperty("name");
        expect(Array.isArray(bookmarked.tags)).toBe(true);
    });

    it("bookmarking is isolated per user", async () => {
        const { jwtToken: otherToken } = await createUserAndLogin();

        await request(app)
            .post(`/api/questions/${question._id}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);

        const mineRes = await request(app)
            .get("/api/questions/bookmarked")
            .set("Authorization", `Bearer ${jwtToken}`);
        const otherRes = await request(app)
            .get("/api/questions/bookmarked")
            .set("Authorization", `Bearer ${otherToken}`);

        expect(mineRes.body.data).toHaveLength(1);
        expect(otherRes.body.data).toHaveLength(0);
    });

    it("a user can bookmark their own authored question", async () => {
        const ownQuestion = await createQuestion({ author: mockUser._id });

        const res = await request(app)
            .post(`/api/questions/${ownQuestion._id}/bookmark`)
            .set("Authorization", `Bearer ${jwtToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.bookmarked).toBe(true);
    });
});
