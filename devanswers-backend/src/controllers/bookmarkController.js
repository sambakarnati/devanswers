import {
    toggleBookmarkService,
    getBookmarkedQuestionsService,
} from "../services/bookmarkService.js";

export const toggleBookmark = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const { bookmarked } = await toggleBookmarkService(id, userId);

    res.status(200).json({
        success: true,
        message: bookmarked
            ? "Question bookmarked successfully"
            : "Question bookmark removed successfully",
        data: { bookmarked },
    });
};

export const getBookmarkedQuestions = async (req, res) => {
    const userId = req.user.id;
    const questions = await getBookmarkedQuestionsService(userId);

    res.status(200).json({
        success: true,
        message: "Bookmarked questions retrieved successfully",
        data: questions,
    });
};
