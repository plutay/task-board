import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

type Comment = {
  id: string;
  content: string;
  created_at: string;
};

type Activity = {
  id: string;
  action: string;
  created_at: string;
};

type Task = {
  id: string;
  title: string;
};

export function TaskDetailModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [task.id]);

  async function loadDetail() {
    setLoading(true);
    const [commentsRes, activityRes] = await Promise.all([
      supabase.from('comments').select('*').eq('task_id', task.id).order('created_at', { ascending: true }),
      supabase.from('task_activity').select('*').eq('task_id', task.id).order('created_at', { ascending: false }),
    ]);
    if (commentsRes.data) setComments(commentsRes.data as Comment[]);
    if (activityRes.data) setActivity(activityRes.data as Activity[]);
    setLoading(false);
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);
    const { error } = await supabase
      .from('comments')
      .insert({ task_id: task.id, content: newComment.trim() });
    if (!error) {
      setNewComment('');
      await loadDetail();
    }
    setPosting(false);
  }

  function timeAgo(dateStr: string) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task.title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : (
          <>
            <section className="modal-section">
              <h3>Comments</h3>
              <div className="comment-list">
                {comments.length === 0 ? (
                  <p className="empty-state">No comments yet</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="comment">
                      <p>{c.content}</p>
                      <span className="comment-time">{timeAgo(c.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handlePostComment} className="comment-form">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={posting}
                />
                <button type="submit" disabled={posting || !newComment.trim()}>
                  {posting ? 'Posting...' : 'Post'}
                </button>
              </form>
            </section>

            <section className="modal-section">
              <h3>Activity</h3>
              <div className="activity-list">
                {activity.length === 0 ? (
                  <p className="empty-state">No activity yet</p>
                ) : (
                  activity.map((a) => (
                    <div key={a.id} className="activity-item">
                      <span>{a.action}</span>
                      <span className="comment-time">{timeAgo(a.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}