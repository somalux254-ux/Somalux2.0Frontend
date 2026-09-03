/**
 * Feature Management Dashboard
 * Admin interface to manage feature flags, rollouts, and versions
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  Slider,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import axios from 'axios';
import { API_URL } from '../config';

export const FeatureManagement = () => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [formData, setFormData] = useState({
    feature_key: '',
    name: '',
    description: '',
    enabled: true,
    rollout_percentage: 100,
    min_tier: null,
    config: {},
    version: '1.0.0',
  });

  // Fetch features
  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/features`);
      const featureData = response.data.features || {};
      const normalizedFeatures = Array.isArray(featureData)
        ? featureData
        : Object.entries(featureData).map(([featureKey, feature]) => ({
            feature_key: featureKey,
            name: feature.name || featureKey,
            description: feature.description || '',
            rollout_percentage: feature.rollout_percentage ?? 100,
            ...feature,
          }));
      setFeatures(normalizedFeatures);
    } catch (err) {
      console.error('Error fetching features:', err);
      setError('Failed to fetch features');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (feature = null) => {
    if (feature) {
      setEditingFeature(feature);
      setFormData(feature);
    } else {
      setEditingFeature(null);
      setFormData({
        feature_key: '',
        name: '',
        description: '',
        enabled: true,
        rollout_percentage: 100,
        min_tier: null,
        config: {},
        version: '1.0.0',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingFeature(null);
  };

  const handleSaveFeature = async () => {
    try {
      if (!formData.feature_key || !formData.name) {
        setError('Feature key and name are required');
        return;
      }

      await axios.post(`${API_URL}/api/features`, formData);
      setOpenDialog(false);
      fetchFeatures();
      setError(null);
    } catch (err) {
      console.error('Error saving feature:', err);
      setError(err.response?.data?.error || 'Failed to save feature');
    }
  };

  const handleToggleFeature = async (featureKey, currentState) => {
    try {
      const feature = features[featureKey];
      await axios.post(`${API_URL}/api/features`, {
        ...feature,
        enabled: !currentState,
      });
      fetchFeatures();
    } catch (err) {
      console.error('Error toggling feature:', err);
      setError('Failed to toggle feature');
    }
  };

  const handleUpdateRollout = async (featureKey, percentage) => {
    try {
      await axios.post(`${API_URL}/api/features/${featureKey}/rollout`, {
        rollout_percentage: percentage,
      });
      fetchFeatures();
    } catch (err) {
      console.error('Error updating rollout:', err);
      setError('Failed to update rollout');
    }
  };

  const handleDeleteFeature = async (featureKey) => {
    if (window.confirm('Are you sure you want to delete this feature?')) {
      try {
        await axios.delete(`${API_URL}/api/features/${featureKey}`);
        fetchFeatures();
      } catch (err) {
        console.error('Error deleting feature:', err);
        setError('Failed to delete feature');
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <h1>Feature Management</h1>
        <Button variant="contained" color="primary" onClick={() => handleOpenDialog()}>
          Add New Feature
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell><strong>Feature Key</strong></TableCell>
              <TableCell><strong>Name</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Rollout %</strong></TableCell>
              <TableCell><strong>Version</strong></TableCell>
              <TableCell><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(features) ? (
              features.map((feature) => (
                <TableRow key={feature.feature_key}>
                  <TableCell><code>{feature.feature_key}</code></TableCell>
                  <TableCell>{feature.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={feature.enabled ? 'Enabled' : 'Disabled'}
                      color={feature.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ width: 150, mr: 2 }}>
                      <Slider
                        value={feature.rollout_percentage || 100}
                        onChange={(e, value) =>
                          handleUpdateRollout(feature.feature_key, value)
                        }
                        min={0}
                        max={100}
                        marks
                        valueLabelDisplay="auto"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>{feature.version}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => handleOpenDialog(feature)}
                      sx={{ mr: 1 }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      color={feature.enabled ? 'error' : 'success'}
                      onClick={() => handleToggleFeature(feature.feature_key, feature.enabled)}
                      sx={{ mr: 1 }}
                    >
                      {feature.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeleteFeature(feature.feature_key)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No features found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Feature Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingFeature ? 'Edit Feature' : 'Add New Feature'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="Feature Key"
            value={formData.feature_key}
            onChange={(e) => setFormData({ ...formData, feature_key: e.target.value })}
            placeholder="e.g., dark_mode, new_search_ui"
            disabled={!!editingFeature}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Feature Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
            sx={{ mb: 2 }}
          />
          <Box sx={{ mb: 2 }}>
            <label>Enabled</label>
            <Switch
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            />
          </Box>
          <Box sx={{ mb: 2 }}>
            <label>Rollout Percentage: {formData.rollout_percentage}%</label>
            <Slider
              value={formData.rollout_percentage}
              onChange={(e, value) => setFormData({ ...formData, rollout_percentage: value })}
              min={0}
              max={100}
              marks
              valueLabelDisplay="auto"
            />
          </Box>
          <TextField
            fullWidth
            label="Version"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: e.target.value })}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveFeature} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeatureManagement;
