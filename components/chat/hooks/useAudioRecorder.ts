import { useState, useRef, useCallback } from 'react';

interface AudioRecorderState {
  isRecording: boolean;
  recordingTime: number; // en segundos
  audioBlob: Blob | null;
  audioUrl: string | null;
}

export const useAudioRecorder = () => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    recordingTime: 0,
    audioBlob: null,
    audioUrl: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setState((prev) => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false,
        }));
        
        // Detener todos los tracks del stream para liberar el micrófono
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      
      setState({
        isRecording: true,
        recordingTime: 0,
        audioBlob: null,
        audioUrl: null,
      });

      // Iniciar temporizador
      timerIntervalRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, recordingTime: prev.recordingTime + 1 }));
      }, 1000);

    } catch (error) {
      console.error('Error accediendo al micrófono:', error);
      throw error; // Permite al componente manejar el error de permisos
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [state.isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    
    // Resetear inmediatamente sin generar Blob válido (o ignorándolo)
    setState({
      isRecording: false,
      recordingTime: 0,
      audioBlob: null,
      audioUrl: null,
    });
    audioChunksRef.current = [];
  }, [state.isRecording]);

  const clearAudio = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState({
      isRecording: false,
      recordingTime: 0,
      audioBlob: null,
      audioUrl: null,
    });
  }, [state.audioUrl]);

  return {
    isRecording: state.isRecording,
    recordingTime: state.recordingTime,
    audioBlob: state.audioBlob,
    audioUrl: state.audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    clearAudio,
  };
};
