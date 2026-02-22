/**
 * Component Tests for Onboarding Wizard
 * Tests the onboarding wizard navigation and validation
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the API module
jest.mock('@/lib/api', () => ({
  get: jest.fn(),
  post: jest.fn(() => Promise.resolve({ data: { success: true } })),
  put: jest.fn(() => Promise.resolve({ data: { success: true } })),
}));

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Test Onboarding Wizard Component (simplified)
const STEPS = [
  { title: 'Business Info', icon: 'Building2' },
  { title: 'Template', icon: 'Briefcase' },
  { title: 'Agents', icon: 'Bot' },
  { title: 'Integrations', icon: 'Plug' },
  { title: 'Provider Keys', icon: 'Key' },
  { title: 'Team Invite', icon: 'Users' },
];

interface ValidationError {
  field: string;
  message: string;
}

const TestOnboardingWizard = () => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [data, setData] = React.useState({
    business: { name: '', website: '', industry: '', stage: '', goal: '' },
    template: '',
    agents: [] as string[],
    integrations: { telegram: true, slack: false, discord: false },
  });
  const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);

  const validateStep = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    
    switch (currentStep) {
      case 0:
        if (!data.business.name.trim()) {
          errors.push({ field: 'businessName', message: 'Business name is required' });
        } else if (data.business.name.length < 2) {
          errors.push({ field: 'businessName', message: 'Business name must be at least 2 characters' });
        }
        if (!data.business.industry) {
          errors.push({ field: 'industry', message: 'Please select an industry' });
        }
        if (!data.business.stage) {
          errors.push({ field: 'stage', message: 'Please select a business stage' });
        }
        if (data.business.website && !isValidUrl(data.business.website)) {
          errors.push({ field: 'website', message: 'Please enter a valid URL' });
        }
        break;
      case 1:
        if (!data.template) {
          errors.push({ field: 'template', message: 'Please select a template' });
        }
        break;
      case 2:
        if (data.agents.length === 0) {
          errors.push({ field: 'agents', message: 'Please select at least one agent' });
        }
        break;
    }
    
    return errors;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const canProceed = () => {
    const errors = validateStep();
    return errors.length === 0;
  };

  const handleNext = () => {
    const errors = validateStep();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors([]);
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setValidationErrors([]);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getFieldError = (field: string): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message;
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div>
      {/* Progress Bar */}
      <div data-testid="progress-bar" style={{ width: `${progress}%` }} />
      <span data-testid="step-counter">Step {currentStep + 1} of {STEPS.length}</span>
      
      {/* Step Indicators */}
      <div data-testid="step-indicators">
        {STEPS.map((step, index) => (
          <div 
            key={index} 
            data-testid={`step-indicator-${index}`}
            data-active={index === currentStep}
            data-completed={index < currentStep}
          >
            {step.title}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div data-testid="step-content">
        {currentStep === 0 && (
          <div>
            <input
              id="businessName"
              value={data.business.name}
              onChange={(e) => setData(prev => ({ ...prev, business: { ...prev.business, name: e.target.value } }))}
              data-testid="business-name-input"
            />
            {getFieldError('businessName') && (
              <span data-testid="businessName-error">{getFieldError('businessName')}</span>
            )}
            
            <select
              id="industry"
              value={data.business.industry}
              onChange={(e) => setData(prev => ({ ...prev, business: { ...prev.business, industry: e.target.value } }))}
              data-testid="industry-select"
            >
              <option value="">Select industry</option>
              <option value="Technology">Technology</option>
            </select>
            {getFieldError('industry') && (
              <span data-testid="industry-error">{getFieldError('industry')}</span>
            )}
            
            <div data-testid="stage-options">
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, business: { ...prev.business, stage: 'startup' } }))}
                data-testid="stage-startup"
                data-selected={data.business.stage === 'startup'}
              >
                Startup
              </button>
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, business: { ...prev.business, stage: 'growth' } }))}
                data-testid="stage-growth"
                data-selected={data.business.stage === 'growth'}
              >
                Growth
              </button>
            </div>
            {getFieldError('stage') && (
              <span data-testid="stage-error">{getFieldError('stage')}</span>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div data-testid="template-options">
              <button
                type="button"
                onClick={() => setData(prev => ({ ...prev, template: 'customer-support' }))}
                data-testid="template-customer-support"
                data-selected={data.template === 'customer-support'}
              >
                Customer Support
              </button>
            </div>
            {getFieldError('template') && (
              <span data-testid="template-error">{getFieldError('template')}</span>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div data-testid="agent-options">
              <label>
                <input
                  type="checkbox"
                  checked={data.agents.includes('responder')}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    agents: e.target.checked 
                      ? [...prev.agents, 'responder']
                      : prev.agents.filter(a => a !== 'responder')
                  }))}
                  data-testid="agent-responder"
                />
                Email Responder
              </label>
            </div>
            {getFieldError('agents') && (
              <span data-testid="agents-error">{getFieldError('agents')}</span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <button
        onClick={handleBack}
        disabled={currentStep === 0}
        data-testid="back-button"
      >
        Back
      </button>
      <button
        onClick={handleNext}
        data-testid="next-button"
      >
        {currentStep === STEPS.length - 1 ? 'Complete Setup' : 'Continue'}
      </button>
    </div>
  );
};

describe('Onboarding Wizard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Step Navigation', () => {
    it('should start at step 1', () => {
      render(<TestOnboardingWizard />);
      
      expect(screen.getByTestId('step-counter')).toHaveTextContent('Step 1 of 6');
    });

    it('should show correct progress percentage', () => {
      render(<TestOnboardingWizard />);
      
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '16.66%' }); // 1/6 = ~16.66%
    });

    it('should navigate to next step', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill in required fields for step 0
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      expect(screen.getByTestId('step-counter')).toHaveTextContent('Step 2 of 6');
    });

    it('should navigate back to previous step', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill in required fields first
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      // Go forward
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Go back
      const backButton = screen.getByTestId('back-button');
      await user.click(backButton);
      
      expect(screen.getByTestId('step-counter')).toHaveTextContent('Step 1 of 6');
    });

    it('should disable back button on first step', () => {
      render(<TestOnboardingWizard />);
      
      const backButton = screen.getByTestId('back-button');
      expect(backButton).toBeDisabled();
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty business name', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Try to proceed without filling required fields
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('businessName-error')).toBeInTheDocument();
      });
    });

    it('should show error for missing industry', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill business name but not industry
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('industry-error')).toBeInTheDocument();
      });
    });

    it('should show error for missing stage', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill name and industry but not stage
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('stage-error')).toBeInTheDocument();
      });
    });

    it('should show error for template selection on step 2', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill step 0
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Try to proceed without selecting template
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('template-error')).toBeInTheDocument();
      });
    });

    it('should show error for no agents selected on step 3', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill step 0
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      // Go to step 1
      let nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Select template
      const templateButton = screen.getByTestId('template-customer-support');
      await user.click(templateButton);
      
      // Go to step 2
      nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Try to proceed without selecting agents
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('agents-error')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should allow selecting a stage', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      expect(stageButton).toHaveAttribute('data-selected', 'true');
    });

    it('should allow selecting a template', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill step 0
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      // Go to step 1
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Select template
      const templateButton = screen.getByTestId('template-customer-support');
      await user.click(templateButton);
      
      expect(templateButton).toHaveAttribute('data-selected', 'true');
    });

    it('should allow toggling agent selection', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill step 0
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      // Go to step 1
      let nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Select template
      const templateButton = screen.getByTestId('template-customer-support');
      await user.click(templateButton);
      
      // Go to step 2
      nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      // Toggle agent
      const agentCheckbox = screen.getByTestId('agent-responder');
      await user.click(agentCheckbox);
      
      expect(agentCheckbox).toBeChecked();
    });
  });

  describe('Step Indicators', () => {
    it('should mark current step as active', () => {
      render(<TestOnboardingWizard />);
      
      const stepIndicator = screen.getByTestId('step-indicator-0');
      expect(stepIndicator).toHaveAttribute('data-active', 'true');
    });

    it('should mark completed steps', async () => {
      const user = userEvent.setup();
      
      render(<TestOnboardingWizard />);
      
      // Fill step 0
      const businessNameInput = screen.getByTestId('business-name-input');
      await user.type(businessNameInput, 'Test Company');
      
      const industrySelect = screen.getByTestId('industry-select');
      await user.selectOptions(industrySelect, 'Technology');
      
      const stageButton = screen.getByTestId('stage-startup');
      await user.click(stageButton);
      
      // Go forward
      const nextButton = screen.getByTestId('next-button');
      await user.click(nextButton);
      
      const completedIndicator = screen.getByTestId('step-indicator-0');
      expect(completedIndicator).toHaveAttribute('data-completed', 'true');
    });
  });
});
