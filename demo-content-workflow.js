/**
 * SquadOps Real-World Demo: Content Marketing Workflow
 * 
 * This demonstrates how SquadOps can be used to automate
 * a complete content marketing workflow using AI agents.
 */

const http = require('http');

const API_BASE = 'localhost';
const API_PORT = 4000;

// Helper for API calls
function apiCall(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runDemo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     SquadOps Real-World Demo: Content Marketing           ║');
  console.log('║     Using AI Agent Swarms for End-to-End Automation       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 1: Login
  console.log('📱 STEP 1: Authentication');
  console.log('─────────────────────────────────────────────────────────────');
  const loginRes = await apiCall('POST', '/api/auth/login', {
    email: 'admin@squadops.local',
    password: 'SquadOps2024!'
  });
  const token = loginRes.accessToken;
  console.log(`   ✅ Logged in as: ${loginRes.user.email}`);
  console.log(`   ✅ Role: ${loginRes.user.role}`);
  console.log();

  // Step 2: Get available agents
  console.log('🤖 STEP 2: Discover AI Agents');
  console.log('─────────────────────────────────────────────────────────────');
  const agentsRes = await apiCall('GET', '/api/agents', null, token);
  const keyAgents = agentsRes.agents.filter(a => 
    ['scout', 'scribe', 'lens', 'oracle', 'beacon', 'marus'].includes(a.id)
  );
  console.log('   Available agents for content workflow:');
  keyAgents.forEach(agent => {
    console.log(`   • ${agent.name} (${agent.id}): ${agent.specialty}`);
  });
  console.log();

  // Step 3: Create a goal (OKR style)
  console.log('🎯 STEP 3: Create Marketing Goal');
  console.log('─────────────────────────────────────────────────────────────');
  const goalRes = await apiCall('POST', '/api/goals', {
    title: 'Q1 Content Marketing Campaign',
    description: 'Launch comprehensive content strategy to increase brand awareness',
    target_value: 100000,
    unit: 'impressions',
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  }, token);
  const goalId = goalRes.goal?.id;
  console.log(`   ✅ Goal created: ${goalRes.goal?.title}`);
  console.log(`   🎯 Target: ${goalRes.goal?.target_value} ${goalRes.goal?.unit}`);
  console.log();

  // Step 4: Create tasks for each agent
  console.log('📋 STEP 4: Assign Tasks to Agents');
  console.log('─────────────────────────────────────────────────────────────');
  
  const tasks = [
    {
      agent: 'scout',
      title: 'Market Research: Competitor Content Analysis',
      description: 'Analyze top 10 competitors content strategies, identify gaps and opportunities',
      priority: 'high'
    },
    {
      agent: 'scribe',
      title: 'Create Blog Series: "AI in 2025"',
      description: 'Write 5-part blog series about AI trends, 1500 words each, SEO optimized',
      priority: 'high'
    },
    {
      agent: 'lens',
      title: 'SEO Optimization Strategy',
      description: 'Research keywords, optimize content structure, improve search rankings',
      priority: 'medium'
    },
    {
      agent: 'oracle',
      title: 'Performance Analytics Setup',
      description: 'Set up tracking for content performance, define KPIs and dashboards',
      priority: 'medium'
    },
    {
      agent: 'beacon',
      title: 'Social Media Promotion Plan',
      description: 'Create social media calendar, draft posts for LinkedIn, Twitter, and Instagram',
      priority: 'high'
    }
  ];

  const createdTasks = [];
  for (const task of tasks) {
    const taskRes = await apiCall('POST', '/api/tasks', {
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigned_agent: task.agent,
      parent_goal_id: goalId,
      status: 'pending'
    }, token);
    createdTasks.push(taskRes.task);
    console.log(`   ✅ Task created: ${task.title.substring(0, 45)}...`);
    console.log(`      Assigned to: ${task.agent}`);
  }
  console.log();

  // Step 5: Create approval workflow
  console.log('✅ STEP 5: Setup Approval Workflow');
  console.log('─────────────────────────────────────────────────────────────');
  const approvalRes = await apiCall('POST', '/api/approvals', {
    title: 'Content Review: AI Blog Series',
    description: 'Review and approve the 5-part blog series before publication',
    approvers: ['admin@squadops.local'],
    status: 'pending'
  }, token);
  console.log(`   ✅ Approval workflow created: ${approvalRes.approval?.title}`);
  console.log(`      Status: ${approvalRes.approval?.status}`);
  console.log();

  // Step 6: Create recurring task (newsletter)
  console.log('🔄 STEP 6: Setup Recurring Newsletter');
  console.log('─────────────────────────────────────────────────────────────');
  const recurringRes = await apiCall('POST', '/api/recurring', {
    title: 'Weekly Newsletter: AI Industry Updates',
    description: 'Curate and send weekly newsletter with latest AI news and trends',
    cron_expression: '0 9 * * MON', // Every Monday at 9 AM
    assigned_agent: 'scribe',
    enabled: true
  }, token);
  console.log(`   ✅ Recurring task created: ${recurringRes.task?.title}`);
  console.log(`      Schedule: Every Monday at 9:00 AM`);
  console.log();

  // Step 7: Send message to team
  console.log('💬 STEP 7: Team Communication');
  console.log('─────────────────────────────────────────────────────────────');
  const messageRes = await apiCall('POST', '/api/messages', {
    content: '🚀 Content Marketing Campaign launched! All agents are assigned. Scout will start market research today.',
    message_type: 'announcement'
  }, token);
  console.log(`   ✅ Message sent to team`);
  console.log();

  // Step 8: Get summary
  console.log('📊 STEP 8: Campaign Summary');
  console.log('═════════════════════════════════════════════════════════════');
  const finalTasks = await apiCall('GET', '/api/tasks', null, token);
  const finalGoals = await apiCall('GET', '/api/goals', null, token);
  
  console.log();
  console.log('   📈 CAMPAIGN METRICS:');
  console.log(`   • Total Tasks: ${finalTasks.tasks?.length || 0}`);
  console.log(`   • Active Goals: ${finalGoals.goals?.length || 0}`);
  console.log(`   • Agents Involved: ${tasks.length}`);
  console.log(`   • Recurring Jobs: 1 (Weekly Newsletter)`);
  console.log(`   • Pending Approvals: 1`);
  console.log();
  console.log('   🤖 AGENT SWARM STATUS:');
  console.log('   • Scout: Researching competitor content');
  console.log('   • Scribe: Drafting blog series');
  console.log('   • Lens: Analyzing SEO opportunities');
  console.log('   • Oracle: Setting up analytics');
  console.log('   • Beacon: Planning social promotion');
  console.log();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Content Marketing Workflow Successfully Launched!      ║');
  console.log('║  🌐 Access the dashboard at: http://localhost:3000         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
}

runDemo().catch(err => {
  console.error('Demo failed:', err.message);
  process.exit(1);
});
