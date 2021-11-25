import React, { useMemo } from 'react';
import Scrollbar, { ScrollbarProps } from 'react-scrollbars-custom';
import { ElementRenderer } from 'react-scrollbars-custom/dist/types/types';

export const CustomScrollbar: React.FC<ScrollbarProps> = ({
  children,
  ...restProps
}) => {
  const wrapperProps: { renderer: ElementRenderer<HTMLDivElement> } = useMemo(
    () => ({
      renderer: (props) => {
        const { elementRef, ...restProps } = props;

        return (
          <div
            {...restProps}
            ref={elementRef}
            style={{
              ...restProps.style,
            }}
          />
        );
      },
    }),
    [],
  );
  const scrollerProps: { renderer: ElementRenderer<HTMLDivElement> } = useMemo(
    () => ({
      renderer: (props) => {
        const { elementRef, ...restProps } = props;
        return <div {...restProps} ref={elementRef} />;
      },
    }),
    [],
  );
  const thumbYProps: { renderer: ElementRenderer<HTMLDivElement> } = useMemo(
    () => ({
      renderer: (props) => {
        const { elementRef } = props;

        return (
          <div
            ref={elementRef}
            style={{
              width: 5,
              backgroundColor: '#aaa',
              cursor: 'pointer',
            }}
          />
        );
      },
    }),
    [],
  );
  const trackYProps: { renderer: ElementRenderer<HTMLDivElement> } = useMemo(
    () => ({
      renderer: (props) => {
        const { elementRef, ...restProps } = props;

        return (
          <div
            ref={elementRef}
            {...restProps}
            style={{
              ...restProps.style,
              backgroundColor: 'rgba(0,0,0,0)',
              width: 4,
            }}
          />
        );
      },
    }),

    [],
  );

  const thumbXProps: { renderer: ElementRenderer<HTMLDivElement> } = useMemo(
    () => ({
      renderer: (props) => {
        const { elementRef } = props;

        return (
          <div
            ref={elementRef}
            style={{
              height: 5,
              backgroundColor: '#aaa',
              cursor: 'pointer',
            }}
          />
        );
      },
    }),
    [],
  );
  const trackXProps: { renderer: ElementRenderer<HTMLDivElement> } = useMemo(
    () => ({
      renderer: (props) => {
        const { elementRef, ...restProps } = props;

        return (
          <div
            ref={elementRef}
            {...restProps}
            style={{
              ...restProps.style,
              backgroundColor: 'rgba(0,0,0,0)',
              height: 4,
            }}
          />
        );
      },
    }),

    [],
  );

  return (
    // @ts-ignore
    <Scrollbar
      wrapperProps={wrapperProps}
      scrollerProps={scrollerProps}
      thumbYProps={thumbYProps}
      trackYProps={trackYProps}
      thumbXProps={thumbXProps}
      trackXProps={trackXProps}
      style={{ width: '100%', height: '100%' }}
      {...restProps}
    >
      {children}
    </Scrollbar>
  );
};
