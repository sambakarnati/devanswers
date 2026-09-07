import { useState } from 'react';
import { Card, Button } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import { voteAnswer, updateAnswer } from '../../reducers/questionSlice';
import { useEditingState } from '../../hooks/useEditingState';
import { summarizeAnswers } from '../../services/aiService';
import AnswerCard from './AnswerCard';
import './AnswerList.css';

const AnswerList = ({ answers, question }) => {
  const dispatch = useDispatch();
  const userInfo = useSelector((state) => state.user.userInfo);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);

  // Keyed by answer id, so only one answer's edit form is open at a time.
  const { isEditing, startEditing, cancelEditing, isSaving, save } = useEditingState();
  const [editAnswerText, setEditAnswerText] = useState('');

  const handleStartEditing = (answer) => {
    setEditAnswerText(answer.answerText);
    startEditing(answer._id);
  };

  const handleSave = async (e, answerId) => {
    e.preventDefault();
    try {
      await save(() =>
        dispatch(updateAnswer({ answerId, answerText: editAnswerText })).unwrap(),
      );
    } catch (error) {
      alert(`Failed to update answer: ${error}`);
    }
  };

  const handleSummarize = async () => {
    setSummaryLoading(true);
    try {
      const data = await summarizeAnswers(question?.title, question?.description, answers, userInfo?.token);
      setSummary(data.summary);
      setSummaryVisible(true);
    } catch (err) {
      alert('Failed to summarize answers. Please try again.');
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <Card className="alist-card">
      <Card.Body className="p-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h4 className="mb-0 alist-title">
            {answers?.length || 0} {answers?.length === 1 ? 'Answer' : 'Answers'}
          </h4>
          {answers?.length >= 3 && !summaryVisible && !!userInfo && (
            <Button
              size="sm"
              variant="outline-secondary"
              className="alist-summarize-btn"
              onClick={handleSummarize}
              disabled={summaryLoading}
            >
              {summaryLoading ? 'Summarizing...' : 'Summarize Answers'}
            </Button>
          )}
        </div>

        {summaryVisible && summary && (
          <div className="alist-summary-banner mb-3">
            <div className="alist-summary-header">
              <span className="alist-summary-label">AI Summary</span>
              <Button
                size="sm"
                variant="link"
                className="alist-summary-dismiss"
                onClick={() => setSummaryVisible(false)}
              >
                Dismiss
              </Button>
            </div>
            <p className="alist-summary-text mb-0">{summary}</p>
          </div>
        )}

        {answers && answers.length > 0 ? (
          answers.map((answer) => (
            <AnswerCard
              key={answer._id}
              answer={answer}
              isAuthor={answer.author?._id === userInfo?.userId}
              isEditing={isEditing(answer._id)}
              editText={editAnswerText}
              onEditTextChange={setEditAnswerText}
              onStartEdit={() => handleStartEditing(answer)}
              onSave={(e) => handleSave(e, answer._id)}
              onCancel={cancelEditing}
              isSaving={isSaving}
              onVote={(voteType) => dispatch(voteAnswer({ answer, voteType }))}
            />
          ))
        ) : (
          <div className="text-center py-4">
            <p className="mb-0 alist-meta">No answers yet. Be the first to answer!</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default AnswerList;
