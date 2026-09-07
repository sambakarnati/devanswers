import { Button } from 'react-bootstrap';
import { FaPencilAlt } from 'react-icons/fa';

/**
 * Shared pencil-icon edit button used by QuestionContent and AnswerList.
 * No auth-guard or ownership logic here - the caller only renders this once it
 * has already determined the current user is the author (mirrors how
 * VoteButtons/BookmarkButton take precomputed props rather than re-deriving
 * auth state themselves).
 */
const EditControls = ({ onEdit, className = '', variant = 'outline-secondary' }) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={className}
      aria-label="Edit"
      title="Edit"
    >
      <FaPencilAlt />
    </Button>
  );
};

export default EditControls;
