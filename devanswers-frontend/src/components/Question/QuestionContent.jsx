import { useState } from 'react';
import { Card, Row, Col, Badge, Form, Button } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { FaUser, FaClock } from 'react-icons/fa';
import { voteQuestion, toggleBookmarkQuestion, updateQuestion } from '../../reducers/questionSlice';
import { formatDate } from '../../utils/timeFormat';
import VoteButtons from '../Shared/VoteButtons';
import BookmarkButton from '../Shared/BookmarkButton';
import EditControls from '../Shared/EditControls';
import './QuestionContent.css';

const QuestionContent = ({ question }) => {

  const dispatch = useDispatch();
  const userInfo = useSelector((state) => state.user.userInfo);
  const bookmarkedQuestionIds = useSelector(
    (state) => state.question.bookmarkedQuestionIds ?? [],
  );
  const isBookmarked = bookmarkedQuestionIds.includes(question._id);
  const isAuthor = question.author?._id === userInfo?.userId;

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');

  const startEditing = () => {
    setEditTitle(question.title);
    setEditDescription(question.description);
    setEditTags(question.tags?.map((tag) => tag.name).join(', ') || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await dispatch(
        updateQuestion({
          questionId: question._id,
          title: editTitle,
          description: editDescription,
          tags: editTags,
        }),
      ).unwrap();
      setIsEditing(false);
    } catch (error) {
      alert(`Failed to update question: ${error}`);
    }
  };

  const canSave = editTitle.trim() && editDescription.trim();

  return (
    <>
      {/* Question Header */}
      <Card className="mb-4 qcontent-header-card">
        <Card.Body className="p-3 p-sm-4">
          <div className="d-flex align-items-start justify-content-between">
            <Card.Title as="h2" className="mb-3 qcontent-title">
              {question.title}
            </Card.Title>
            {isAuthor && !isEditing && (
              <EditControls onEdit={startEditing} className="ms-2 qcontent-edit-btn" />
            )}
          </div>
          <div className="d-flex flex-wrap gap-3 gap-sm-4 qcontent-meta">
            <span className="d-flex align-items-center gap-2">
              <FaClock />
              Asked {formatDate(question.createdAt)}
            </span>
            {question.editedAt && (
              <span className="d-flex align-items-center gap-2 qcontent-edited">
                edited {formatDate(question.editedAt)}
              </span>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Question Content */}
      <Card className="mb-4 qcontent-body-card">
        <Card.Body className="p-3 p-sm-4">
          {isEditing ? (
            <Form onSubmit={handleSave} className="qcontent-edit-form">
              <Form.Group className="mb-3">
                <Form.Label htmlFor="edit-title">Title</Form.Label>
                <Form.Control
                  type="text"
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="edit-description">Description</Form.Label>
                <Form.Control
                  as="textarea"
                  id="edit-description"
                  rows={6}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label htmlFor="edit-tags">Tags (comma-separated)</Form.Label>
                <Form.Control
                  type="text"
                  id="edit-tags"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button type="submit" variant="primary" disabled={!canSave}>
                  Save
                </Button>
                <Button type="button" variant="outline-secondary" onClick={cancelEditing}>
                  Cancel
                </Button>
              </div>
            </Form>
          ) : (
            <Row>
              {/* Voting Controls */}
              <Col xs="auto" className="d-flex flex-column align-items-center pe-3 pe-sm-4">
                <VoteButtons
                  voteCount={question.voteCount}
                  authorId={question.author?._id}
                  onVote={(voteType) => dispatch(voteQuestion({ question, voteType }))}
                  variant="outline-secondary"
                  upClassName="mb-2 qcontent-vote-btn"
                  downClassName="mt-2 qcontent-vote-btn"
                  countClassName="qcontent-vote-count"
                  upIconClassName="qcontent-icon-up"
                  downIconClassName="qcontent-icon-down"
                  itemType="question"
                />
                <BookmarkButton
                  questionId={question._id}
                  isBookmarked={isBookmarked}
                  onToggle={(questionId) => {
                    dispatch(toggleBookmarkQuestion({ questionId }));
                  }}
                  variant="outline-secondary"
                  className="mt-2 qcontent-bookmark-btn"
                />
              </Col>

              {/* Main Content */}
              <Col>
                <div className="mb-4 qcontent-description">
                  {question.description}
                </div>

                <div className="mb-4">
                  {question.tags?.map((tag) => (
                    <Badge
                      key={tag._id}
                      className="me-2 mb-2 qcontent-tag-badge"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>

                <div
                  className="d-flex align-items-center gap-2 qcontent-author-row"
                >
                  <FaUser className="qcontent-icon-sm" />
                  <span>Posted by </span>
                  <strong className="qcontent-author-name">{question.author?.name}</strong>
                </div>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>
    </>
  );
};

export default QuestionContent;
