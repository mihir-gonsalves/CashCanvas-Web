// frontend/src/components/layout/AppHeader.tsx
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { QuestionMarkRounded } from '@mui/icons-material';
import { LearnDialog } from '../learn/LearnDialog';
import { useLoadDemo } from '@/hooks/useLoadDemo';

export function AppHeader() {
  const [learnOpen, setLearnOpen] = useState(false);
  const [demoStarted, setDemoStarted] = useState(false);
  const { mutate: loadDemo, isPending } = useLoadDemo();

  const handleTryDemo = () => {
    setDemoStarted(true);
    loadDemo();
  };

  return (
    <>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          px: 8,
          borderBottom: '3px solid #1f3a5f'
        }}
      >
        <Typography variant="h1" color="#1f3a5f">
          CashCanvas
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 5
          }}
        >
          <Button
            variant="contained"
            onClick={handleTryDemo}
            disabled={isPending || demoStarted}
            sx={{
              px: 2,
              borderRadius: 2.5,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: '#0e2238',
              },
              '&:disabled': {
                backgroundColor: '#e5e7eb',
                color: '#9ca3af',
              },
            }}
          >
            {demoStarted ? 'Demo Loaded' : isPending ? 'Loading...' : 'Try Demo'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => setLearnOpen(true)}
            sx={{
              height: 50,
              minWidth: 50,
              padding: 0,
              borderRadius: '50%',
              '&:hover': {
                borderColor: '#0e2238',
                backgroundColor: 'rgba(31, 58, 95, 0.04)',
              },
            }}
          >
            <QuestionMarkRounded />
          </Button>
        </Box>
      </Box>

      <LearnDialog
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
      />
    </>
  );
}