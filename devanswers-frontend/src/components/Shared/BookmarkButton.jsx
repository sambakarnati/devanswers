import { Button } from 'react-bootstrap';
import { FaBookmark, FaRegBookmark } from 'react-icons/fa';
import { useSelector } from 'react-redux';

/**
 * Shared bookmark button used by QuestionCard and QuestionContent.
 * Handles the auth guard internally (mirrors VoteButtons), but unlike VoteButtons
 * there is no self-bookmark restriction - a user can bookmark their own question.
 */
const BookmarkButton = ({
  questionId,
  isBookmarked,
  onToggle,
  variant = 'link',
  className = '',
  iconClassName = '',
}) => {
  const { userInfo } = useSelector((state) => state.user);
  const isAuthenticated = !!userInfo;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      alert('You must be logged in to bookmark a question.');
      return;
    }

    onToggle(questionId);
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={className}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
      title={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
    >
      {isBookmarked ? (
        <FaBookmark className={iconClassName} />
      ) : (
        <FaRegBookmark className={iconClassName} />
      )}
    </Button>
  );
};

export default BookmarkButton;
