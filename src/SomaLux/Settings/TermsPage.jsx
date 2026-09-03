import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AgreementTab } from './tabs/UserAgreement';

export default function TermsPage() {
  const navigate = useNavigate();

  return <AgreementTab onBack={() => navigate(-1)} pageTitle="User Agreement" />;
}
