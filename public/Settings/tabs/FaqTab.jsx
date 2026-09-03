import React, { useState } from 'react';
import './FaqTab.css';

export const FaqTab = ({ onBack }) => {
  const [selectedFAQItem, setSelectedFAQItem] = useState(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customQuestions, setCustomQuestions] = useState([]);

  const faqItems = [
    {
      id: 1,
      question: 'How do I reset my password?',
      answer: 'You can reset your password by clicking "Forgot Password" on the login page. We\'ll send you an email with a secure link to create a new password.'
    },
    {
      id: 2,
      question: 'How can I update my profile information?',
      answer: 'Navigate to Account Settings and click on your profile section. You can update your personal details, profile picture, and contact information from there.'
    },
    {
      id: 3,
      question: 'How do I apply for a job?',
      answer: 'Browse job listings, click on the job you\'re interested in, and click the "Apply" button. Make sure your profile is complete before applying.'
    },
    {
      id: 4,
      question: 'Can I delete my account?',
      answer: 'Yes, you can delete your account from the Account Settings page. This action is permanent and cannot be undone. All your data will be removed from our servers.'
    },
    {
      id: 5,
      question: 'How do I manage my notifications?',
      answer: 'Go to Settings > Notifications and toggle the notification types you want to receive. You can control email, push, and mobile notifications separately.'
    },
    {
      id: 6,
      question: 'What payment methods do you accept?',
      answer: 'We accept major credit cards (Visa, Mastercard, American Express) and digital payment methods available in your region.'
    },
    {
      id: 7,
      question: 'How do I report a problem or bug?',
      answer: 'Use the Feedback tab in Settings to report issues. Include detailed information about what happened, and our team will investigate and follow up with you.'
    },
    {
      id: 8,
      question: 'How long does it take to hear back from support?',
      answer: 'Our support team typically responds within 24-48 hours during business days. For urgent issues, please mark your request as high priority.'
    }
    ,
    {
      id: 9,
      question: 'Can I change my account email?',
      answer: 'Yes — go to Account Settings and edit your email. You may need to verify the new address.'
    },
    {
      id: 10,
      question: 'How do I enable two-factor authentication?',
      answer: 'Navigate to Security in your account and follow the steps to enable 2FA using an authenticator app.'
    },
    {
      id: 11,
      question: 'Where can I find invoices and billing history?',
      answer: 'Billing history and invoices are available under Account > Billing. You can download PDF receipts there.'
    },
    {
      id: 12,
      question: 'How do I contact enterprise sales?',
      answer: 'Use the Contact Support option and choose "Enterprise Sales" or email sales@joblink.example for dedicated assistance.'
    },
    {
      id: 13,
      question: 'How do I track my job applications?',
      answer: 'View all your applications in the Applications tab. You can see application status, employer responses, and interview dates.'
    },
    {
      id: 14,
      question: 'Can employers see my profile?',
      answer: 'Your profile visibility depends on your privacy settings. By default, employers can see your public profile. Adjust visibility in Privacy Settings.'
    },
    {
      id: 15,
      question: 'How do I set up job alerts?',
      answer: 'Go to Preferences and enable Job Alerts. Choose job categories, locations, and salary ranges to receive notifications of matching positions.'
    },
    {
      id: 16,
      question: 'Can I message recruiters directly?',
      answer: 'Yes, you can message recruiters and employers through Joblink. Go to Messages or click on a recruiter\'s profile to start a conversation.'
    },
    {
      id: 17,
      question: 'What are Premium Pro benefits?',
      answer: 'Premium Pro includes priority support, unlimited applications, featured profile visibility, advanced job recommendations, and analytics dashboard.'
    },
    {
      id: 18,
      question: 'How many jobs can I apply for?',
      answer: 'Free users can apply to 5 jobs per week. Premium Pro members have unlimited applications.'
    },
    {
      id: 19,
      question: 'How do I schedule an interview?',
      answer: 'Use the messaging feature to coordinate interview times with recruiters, or use the built-in interview scheduling tool for Premium Pro users.'
    },
    {
      id: 20,
      question: 'What tools are available for recruiters?',
      answer: 'Recruiters can post jobs, filter candidates, track applicants, send bulk messages, and access team collaboration features with Premium Pro.'
    }
  ];

  const handleSubmitCustomQuestion = (e) => {
    e.preventDefault();
    if (customQuestion.trim()) {
      const newQuestion = {
        id: 100 + customQuestions.length,
        question: customQuestion,
        answer: 'Thank you for your question! Our support team will review and respond within 24 hours.'
      };
      setCustomQuestions([...customQuestions, newQuestion]);
      setCustomQuestion('');
    }
  };

  return (
    <div className="faq-page-section">
      <div className="faq-page-items">
        {faqItems.map(item => (
          <div key={item.id} className="faq-page-item">
            <button
              onClick={() => setSelectedFAQItem(selectedFAQItem === item.id ? null : item.id)}
              className="faq-page-question-button"
            >
              <span className="faq-page-star" aria-hidden="true">★</span>
              <span className="faq-page-question-text">{item.question}</span>
            </button>
            {selectedFAQItem === item.id && (
              <p className="faq-page-answer">
                {item.answer}
              </p>
            )}
          </div>
        ))}
        
        {customQuestions.length > 0 && (
          <div className="faq-custom-section">
            <h3 className="faq-custom-title">Your Questions</h3>
            {customQuestions.map(item => (
              <div key={item.id} className="faq-page-item">
                <button
                  onClick={() => setSelectedFAQItem(selectedFAQItem === item.id ? null : item.id)}
                  className="faq-page-question-button"
                >
                  <span className="faq-page-star" aria-hidden="true">★</span>
                  <span className="faq-page-question-text">{item.question}</span>
                </button>
                {selectedFAQItem === item.id && (
                  <p className="faq-page-answer">
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmitCustomQuestion} className="faq-form">
        <textarea
          placeholder="Ask your question here..."
          value={customQuestion}
          onChange={(e) => setCustomQuestion(e.target.value)}
          className="faq-form-input"
        />
        <button
          type="submit"
          className="faq-form-submit"
          disabled={!customQuestion.trim()}
        >
          Submit Question
        </button>
      </form>

      {typeof onBack === 'function' && (
        <button
          type="button"
          onClick={onBack}
          className="faq-page-back-btn"
        >
          Back to Help
        </button>
      )}
    </div>
  );
};
