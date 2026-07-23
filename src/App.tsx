import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';

function App() {
  const { session, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!session) return <p>Failed to start session</p>;

  async function testInsert() {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: 'Test task', status: 'todo' })
      .select();
    console.log('Insert result:', data, error);
  }

  async function testFetch() {
    const { data, error } = await supabase.from('tasks').select('*');
    console.log('Fetch result:', data, error);
  }

  return (
    <div style={{ padding: '2rem' }}>
      <p>Signed in as: {session.user.id}</p>
      <button onClick={testInsert}>Test Insert</button>
      <button onClick={testFetch}>Test Fetch</button>
    </div>
  );
}

export default App;