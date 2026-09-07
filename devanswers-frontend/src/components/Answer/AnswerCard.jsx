import { Card, Row, Col, Button, Form } from 'react-bootstrap';
import { FaUser, FaClock } from 'react-icons/fa';
import { formatDate } from '../../utils/timeFormat';
import VoteButtons from '../Shared/VoteButtons';
import EditControls from '../Shared/EditControls';

/**
 * A single answer, read-only or in its inline edit form. Extracted out of
 * AnswerList's `answers.map` so that loop stays a thin per-item render call
 * instead of mixing per-answer derivation with two large JSX branches.
 */
const AnswerCard = ({
  answer,
  isAuthor,
  isEditing,
  editText,
  onEditTextChange,
  onStartEdit,
  onSave,
  onCancel,
  isSaving,
  onVote,
}) => {
  if (isEditing) {
    const canSave = editText.trim();

    return (
      <Card className="mb-1 alist-answer-card">
        <Card.Body className="p-2">
          <Form onSubmit={onSave} className="alist-edit-form">
            <Form.Group className="mb-2">
              <Form.Control
                as="textarea"
                rows={5}
                value={editText}
                onChange={(e) => onEditTextChange(e.target.value)}
              />
            </Form.Group>
            <div className="d-flex gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={!canSave || isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="mb-1 alist-answer-card">
      <Card.Body className="p-2">
        <Row>
          {/* Voting Controls */}
          <Col xs="auto" className="d-flex flex-column align-items-center align-self-start pe-3">
            <VoteButtons
              voteCount={answer.voteCount}
              authorId={answer.author?._id}
              onVote={onVote}
              variant="outline-secondary"
              upClassName="alist-vote-btn alist-vote-btn-up"
              downClassName="alist-vote-btn alist-vote-btn-down"
              countClassName="alist-vote-count"
              upIconClassName="alist-icon-up"
              downIconClassName="alist-icon-down"
              itemType="answer"
            />
            {isAuthor && (
              <EditControls onEdit={onStartEdit} className="mt-2 alist-edit-btn" />
            )}
          </Col>

          {/* Answer Content */}
          <Col>
            <div className="mb-2 alist-content">
              {answer.answerText}
            </div>
            <div className="mt-2 d-flex align-items-center gap-2 alist-meta">
              <FaUser className="alist-icon-sm" />
              <span>Answered by </span>
              <strong className="alist-author">{answer.author?.name}</strong>
              {answer.createdAt && (
                <>
                  <span className="mx-2">•</span>
                  <FaClock className="alist-icon-sm" />
                  <span>{formatDate(answer.createdAt)}</span>
                </>
              )}
              {answer.editedAt && (
                <>
                  <span className="mx-2">•</span>
                  <span className="alist-edited">edited {formatDate(answer.editedAt)}</span>
                </>
              )}
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default AnswerCard;
